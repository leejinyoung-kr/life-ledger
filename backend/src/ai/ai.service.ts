import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { AiReport } from '@prisma/client';
import OpenAI from 'openai';
import { CryptoService } from '../common/crypto.service';
import { PrismaService } from '../prisma/prisma.service';
import { SystemLogService } from '../system-log/system-log.service';
import type { ReportPeriod } from './dto/generate-report.dto';

export type InsightTone = 'green' | 'warning' | 'danger';

// 모델별 단가 (USD per 1M tokens) — [입력, 출력]. 호출 시점에 비용 산정해 저장(과거 정확성 보존)
// 미등록 모델은 0원 처리 (단가 불명 → 사용량만 기록)
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
  'gpt-4o': { input: 2.5, output: 10.0 },
};

const PERIOD_LABEL: Record<ReportPeriod, (from: Date) => string> = {
  this_month: (from) =>
    `${from.getUTCFullYear()}년 ${from.getUTCMonth() + 1}월`,
  last_month: (from) =>
    `${from.getUTCFullYear()}년 ${from.getUTCMonth() + 1}월`,
  last_3_months: () => '최근 3개월',
  this_year: (from) => `${from.getUTCFullYear()}년 전체`,
};

// Date → 'YYYY-MM-DD'
function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// UTC now → KST 기준 'YYYY-MM-DD' (DB의 created_at도 KST 트리거로 저장되어 동일 기준으로 비교 가능)
function kstDateStr(d: Date): string {
  return new Date(d.getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10);
}

@Injectable()
export class AiService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly sysLog: SystemLogService,
  ) {}

  // 사용자 설정의 OpenAI API 키로 클라이언트 구성. 미설정 시 503
  // 키는 AES-256-GCM 암호문('v1:')으로 저장 — 호출 직전 복호화. 구버전 평문 행은 그대로 사용(하위호환)
  private async getClient(
    userId: number,
  ): Promise<{ openai: OpenAI; model: string }> {
    const settings = await this.prisma.userSettings.findUnique({
      where: { user_id: userId },
    });
    if (!settings?.openai_api_key) {
      throw new ServiceUnavailableException(
        'OpenAI API 키가 설정되지 않았습니다. 설정 페이지에서 등록해주세요.',
      );
    }
    const apiKey = settings.openai_api_key.startsWith('v1:')
      ? this.crypto.decrypt(settings.openai_api_key)
      : settings.openai_api_key;
    return { openai: new OpenAI({ apiKey }), model: settings.openai_model };
  }

  // 저장된 OpenAI 키 연결 확인 — /v1/models 호출로 키 유효성 + 설정 모델 접근 가능 여부 검사
  // (OpenAI는 크레딧 잔액 조회 API를 제공하지 않으므로, 연결·모델 가용성만 확인한다)
  async verifyApiKey(
    userId: number,
  ): Promise<{ ok: boolean; model: string; modelAvailable: boolean }> {
    const { openai, model } = await this.getClient(userId);
    try {
      const list = await openai.models.list();
      const modelAvailable = list.data.some((m) => m.id === model);
      return { ok: true, model, modelAvailable };
    } catch {
      // 401·403 등 → 키 무효/만료
      throw new BadRequestException(
        'OpenAI 키 검증에 실패했습니다. 키가 유효하지 않거나 만료되었습니다.',
      );
    }
  }

  // OpenAI 응답의 usage 를 사용량 로그로 저장. 기록 실패는 본 기능을 막지 않도록 무시한다.
  private async logUsage(
    userId: number,
    model: string,
    source: 'report',
    usage?: {
      prompt_tokens?: number;
      completion_tokens?: number;
      total_tokens?: number;
    } | null,
  ): Promise<void> {
    if (!usage) return;
    const price = MODEL_PRICING[model] ?? { input: 0, output: 0 };
    const prompt = usage.prompt_tokens ?? 0;
    const completion = usage.completion_tokens ?? 0;
    const cost =
      (prompt / 1e6) * price.input + (completion / 1e6) * price.output;
    try {
      await this.prisma.aiUsageLog.create({
        data: {
          user_id: userId,
          model,
          source,
          prompt_tokens: prompt,
          completion_tokens: completion,
          total_tokens: usage.total_tokens ?? prompt + completion,
          cost_usd: cost,
        },
      });
    } catch (e) {
      this.sysLog.warn({
        userId,
        category: 'ai',
        message: 'AI 사용량 기록 실패',
        metadata: {
          model,
          source,
          error: (e as Error).message,
          inputTokens: prompt,
          outputTokens: completion,
        },
      });
    }
  }

  // 이번 달(KST) AI 사용량 집계 — 호출 수·토큰·비용 합계 + 모델별 분해
  async getUsageSummary(userId: number) {
    const nowKst = new Date(Date.now() + 9 * 3600 * 1000);
    const y = nowKst.getUTCFullYear();
    const m = nowKst.getUTCMonth();
    // created_at은 KST 벽시계 naive 값으로 저장됨 → 월초도 KST 기준 naive(UTC라벨)로 비교
    const monthStart = new Date(Date.UTC(y, m, 1));

    const rows = await this.prisma.aiUsageLog.findMany({
      where: { user_id: userId, created_at: { gte: monthStart } },
      orderBy: { created_at: 'desc' },
    });

    let promptTokens = 0;
    let completionTokens = 0;
    let totalTokens = 0;
    let costUsd = 0;
    const byModelMap = new Map<
      string,
      { calls: number; totalTokens: number; costUsd: number }
    >();
    for (const r of rows) {
      promptTokens += r.prompt_tokens;
      completionTokens += r.completion_tokens;
      totalTokens += r.total_tokens;
      costUsd += r.cost_usd.toNumber();
      const cur = byModelMap.get(r.model) ?? {
        calls: 0,
        totalTokens: 0,
        costUsd: 0,
      };
      cur.calls += 1;
      cur.totalTokens += r.total_tokens;
      cur.costUsd += r.cost_usd.toNumber();
      byModelMap.set(r.model, cur);
    }

    return {
      month: `${y}-${String(m + 1).padStart(2, '0')}`,
      calls: rows.length,
      promptTokens,
      completionTokens,
      totalTokens,
      costUsd: Number(costUsd.toFixed(6)),
      lastUsedAt: rows[0] ? rows[0].created_at.toISOString() : null,
      byModel: Array.from(byModelMap.entries()).map(([model, v]) => ({
        model,
        calls: v.calls,
        totalTokens: v.totalTokens,
        costUsd: Number(v.costUsd.toFixed(6)),
      })),
    };
  }

  // 분석 기간 코드 → 시작일/종료일/표시 라벨
  private periodRange(period: ReportPeriod): {
    from: Date;
    to: Date;
    label: string;
  } {
    const now = new Date();
    const y = now.getUTCFullYear();
    const m = now.getUTCMonth();
    let from: Date;
    let to: Date;
    switch (period) {
      case 'last_month':
        from = new Date(Date.UTC(y, m - 1, 1));
        to = new Date(Date.UTC(y, m, 0));
        break;
      case 'last_3_months':
        from = new Date(Date.UTC(y, m - 2, 1));
        to = new Date(Date.UTC(y, m + 1, 0));
        break;
      case 'this_year':
        from = new Date(Date.UTC(y, 0, 1));
        to = new Date(Date.UTC(y, 11, 31));
        break;
      default: // this_month
        from = new Date(Date.UTC(y, m, 1));
        to = new Date(Date.UTC(y, m + 1, 0));
    }
    return { from, to, label: PERIOD_LABEL[period](from) };
  }

  // 엔티티 → 응답 DTO
  private toDto(r: AiReport) {
    return {
      id: r.id,
      periodLabel: r.period_label,
      periodFrom: toDateStr(r.period_from),
      periodTo: toDateStr(r.period_to),
      modelUsed: r.model_used,
      summary: r.summary,
      insights: r.insights as unknown as { tone: InsightTone; text: string }[],
      tags: r.tags as unknown as string[],
      createdAt: r.created_at.toISOString(),
    };
  }

  // 저장된 AI 리포트 목록 (최신순)
  async listReports(userId: number) {
    const rows = await this.prisma.aiReport.findMany({
      where: { user_id: userId },
      orderBy: { created_at: 'desc' },
    });
    return rows.map((r) => this.toDto(r));
  }

  // 기간별 가계부 데이터를 분석해 AI 리포트를 생성·저장 (하루 1회 제한 — KST 자정 기준 초기화)
  async generateReport(userId: number, period: ReportPeriod) {
    const latest = await this.prisma.aiReport.findFirst({
      where: { user_id: userId },
      orderBy: { created_at: 'desc' },
      select: { created_at: true },
    });
    // created_at은 KST 트리거로 이미 KST 벽시계 시각이 저장되므로 toDateStr로 그대로 날짜 추출(kstDateStr 적용 시 +9h 이중 적용 버그)
    if (latest && toDateStr(latest.created_at) === kstDateStr(new Date())) {
      const nowKst = new Date(Date.now() + 9 * 3600 * 1000);
      const msSinceKstMidnight =
        nowKst.getTime() -
        Date.UTC(
          nowKst.getUTCFullYear(),
          nowKst.getUTCMonth(),
          nowKst.getUTCDate(),
        );
      const remainingHours = Math.ceil(
        (24 * 60 * 60 * 1000 - msSinceKstMidnight) / (60 * 60 * 1000),
      );
      throw new BadRequestException(
        `리포트는 하루에 한 번만 생성할 수 있습니다. 자정 이후 약 ${remainingHours}시간 후에 다시 시도해주세요.`,
      );
    }

    const { openai, model } = await this.getClient(userId);
    const { from, to, label } = this.periodRange(period);

    const transactions = await this.prisma.transaction.findMany({
      where: {
        user_id: userId,
        deleted_at: null,
        date: { gte: from, lte: to },
      },
    });
    if (!transactions.length) {
      throw new BadRequestException(
        '해당 기간에 분석할 가계부 내역이 없습니다.',
      );
    }

    const categories = await this.prisma.category.findMany({
      where: { domain: 'transaction' },
      select: { code: true, label: true },
    });
    const catLabel = new Map(categories.map((c) => [c.code, c.label]));

    let income = 0;
    let expense = 0;
    const byCategory = new Map<string, number>();
    for (const t of transactions) {
      const amount = t.amount.toNumber();
      if (t.type === 'income') income += amount;
      else if (t.type === 'expense') {
        expense += amount;
        const label = catLabel.get(t.category) ?? t.category;
        byCategory.set(label, (byCategory.get(label) ?? 0) + amount);
      }
    }
    const breakdown = Array.from(byCategory.entries())
      .sort((a, b) => b[1] - a[1])
      .map(
        ([catName, total]) =>
          `- ${catName}: ${total.toLocaleString()}원 (지출의 ${Math.round((total / (expense || 1)) * 100)}%)`,
      )
      .join('\n');

    const userPrompt = `분석 기간: ${label} (${toDateStr(from)} ~ ${toDateStr(to)})
총 수입: ${income.toLocaleString()}원
총 지출: ${expense.toLocaleString()}원
거래 건수: ${transactions.length}건

카테고리별 지출 내역:
${breakdown}

이 가계부 데이터를 분석해 소비 패턴과 절약 인사이트를 아래 JSON 형식으로만 반환하세요.

{
  "summary": "기간을 요약하는 1~2문장 (총 지출·수입 대비 비율 등 구체적 수치 포함)",
  "insights": [{"tone": "green 또는 warning 또는 danger", "text": "구체적 수치를 포함한 인사이트 문장"}],
  "tags": ["짧은 키워드 태그 3~5개"]
}

규칙:
- insights 는 3~5개. 긍정적 패턴은 green, 주의가 필요하면 warning, 위험 신호는 danger
- 모든 문장에 구체적인 금액·비율 수치를 포함
- 한국어로 작성, JSON 외 텍스트는 포함하지 않음`;

    const response = await openai.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content:
            '당신은 개인 재무 분석 AI입니다. 가계부 데이터를 분석해 통찰력 있는 소비 패턴 리포트를 작성하고, 반드시 JSON 형식으로만 응답하세요.',
        },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.5,
    });
    await this.logUsage(userId, model, 'report', response.usage);

    const raw = response.choices[0].message.content ?? '{}';
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const insights = Array.isArray(parsed['insights'])
      ? (parsed['insights'] as unknown[]).map((item) => {
          const obj = (item ?? {}) as Record<string, unknown>;
          const tone: InsightTone =
            obj['tone'] === 'warning' || obj['tone'] === 'danger'
              ? obj['tone']
              : 'green';
          return { tone, text: String(obj['text'] ?? '') };
        })
      : [];
    const tags = Array.isArray(parsed['tags'])
      ? (parsed['tags'] as unknown[]).map(String)
      : [];

    const created = await this.prisma.aiReport.create({
      data: {
        user_id: userId,
        period_label: label,
        period_from: from,
        period_to: to,
        model_used: model,
        summary: String(parsed['summary'] ?? ''),
        insights: insights,
        tags: tags,
      },
    });
    this.sysLog.info({
      userId,
      category: 'ai',
      message: `AI 리포트 생성 완료 — ${label}`,
      metadata: { period, model, tokensUsed: response.usage?.total_tokens },
    });
    return this.toDto(created);
  }
}
