import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { AiReport, Prisma } from '@prisma/client';
import OpenAI from 'openai';
import { PrismaService } from '../prisma/prisma.service';
import type { ReportPeriod } from './dto/generate-report.dto';

export interface LedgerParseResult {
  type: 'income' | 'expense' | 'transfer';
  amount: number;
  category: string | null;
  categoryLabel: string;
  title: string;
  payMethod: string;
  memo: string;
  date: string;
}

export type InsightTone = 'green' | 'warning' | 'danger';

// 가계부 등록 폼과 동일한 결제수단 목록 (frontend/lib/finance.ts PAY_METHODS)
const PAY_METHODS = ['신한카드', '카카오페이', '현금', '계좌이체'];

const PERIOD_LABEL: Record<ReportPeriod, (from: Date) => string> = {
  this_month: (from) => `${from.getUTCFullYear()}년 ${from.getUTCMonth() + 1}월`,
  last_month: (from) => `${from.getUTCFullYear()}년 ${from.getUTCMonth() + 1}월`,
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
  constructor(private readonly prisma: PrismaService) {}

  // 사용자 설정의 OpenAI API 키로 클라이언트 구성. 미설정 시 503
  private async getClient(userId: number): Promise<{ openai: OpenAI; model: string }> {
    const settings = await this.prisma.userSettings.findUnique({ where: { user_id: userId } });
    if (!settings?.openai_api_key) {
      throw new ServiceUnavailableException('OpenAI API 키가 설정되지 않았습니다. 설정 페이지에서 등록해주세요.');
    }
    return { openai: new OpenAI({ apiKey: settings.openai_api_key }), model: settings.openai_model };
  }

  // 분석 기간 코드 → 시작일/종료일/표시 라벨
  private periodRange(period: ReportPeriod): { from: Date; to: Date; label: string } {
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

  // 자연어 텍스트 → 가계부 거래 초안 파싱 (자산관리 - 수입/지출 AI 입력)
  async parseLedgerEntry(userId: number, text: string): Promise<LedgerParseResult> {
    const { openai, model } = await this.getClient(userId);

    const categories = await this.prisma.category.findMany({
      where: { user_id: userId, domain: 'transaction', is_active: true },
      orderBy: { sort_order: 'asc' },
    });
    const categoryList = categories.map((c) => `- ${c.label} (code: ${c.code})`).join('\n');
    const today = toDateStr(new Date());

    const systemPrompt = `당신은 가계부 거래 파싱 AI입니다. 사용자의 자연어 텍스트를 분석해서 거래 정보를 JSON으로만 반환하세요.

오늘 날짜: ${today}

사용 가능한 카테고리 목록:
${categoryList}

사용 가능한 결제수단: ${PAY_METHODS.join(', ')}

반환 형식 (JSON만 반환, 설명 없음):
{
  "type": "expense" 또는 "income" 또는 "transfer",
  "amount": 숫자 (원 단위, 만원 단위 자동 변환),
  "category": "카테고리 code (목록에서 선택, 매칭 불가 시 null)",
  "title": "내역명 (품목·상호 등, 없으면 빈 문자열)",
  "payMethod": "결제수단 (목록에서 선택, 지출이 아니거나 알 수 없으면 빈 문자열)",
  "memo": "메모 (없으면 빈 문자열)",
  "date": "YYYY-MM-DD" (어제/오늘/그저께 등 자연어 변환, 언급 없으면 오늘)
}

규칙:
- "만원" 표현은 × 10000 변환 (1만5천원 → 15000)
- 카테고리는 목록에서 의미가 가장 유사한 항목의 code 선택
- 식당·음식·배달·카페는 식비류, 지하철·버스·택시·주유는 교통류 카테고리 선택
- 월급·용돈·이자 수령·환급 등은 income, 계좌·자산 간 이동(저축 등)은 transfer, 그 외 대부분은 expense`;

    const response = await openai.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: text },
      ],
      response_format: { type: 'json_object' },
      temperature: 0,
    });

    const raw = response.choices[0].message.content ?? '{}';
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const matched = categories.find((c) => c.code === parsed['category']);
    const type = parsed['type'];

    return {
      type: type === 'income' || type === 'transfer' ? type : 'expense',
      amount: Number(parsed['amount']) || 0,
      category: matched?.code ?? null,
      categoryLabel: matched?.label ?? '',
      title: String(parsed['title'] ?? ''),
      payMethod: PAY_METHODS.includes(parsed['payMethod'] as string) ? (parsed['payMethod'] as string) : '',
      memo: String(parsed['memo'] ?? ''),
      date: String(parsed['date'] ?? today),
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
    if (latest && kstDateStr(latest.created_at) === kstDateStr(new Date())) {
      const nowKst = new Date(Date.now() + 9 * 3600 * 1000);
      const msSinceKstMidnight = nowKst.getTime() - Date.UTC(nowKst.getUTCFullYear(), nowKst.getUTCMonth(), nowKst.getUTCDate());
      const remainingHours = Math.ceil((24 * 60 * 60 * 1000 - msSinceKstMidnight) / (60 * 60 * 1000));
      throw new BadRequestException(`리포트는 하루에 한 번만 생성할 수 있습니다. 자정 이후 약 ${remainingHours}시간 후에 다시 시도해주세요.`);
    }

    const { openai, model } = await this.getClient(userId);
    const { from, to, label } = this.periodRange(period);

    const transactions = await this.prisma.transaction.findMany({
      where: { user_id: userId, deleted_at: null, date: { gte: from, lte: to } },
    });
    if (!transactions.length) {
      throw new BadRequestException('해당 기간에 분석할 가계부 내역이 없습니다.');
    }

    const categories = await this.prisma.category.findMany({
      where: { user_id: userId, domain: 'transaction' },
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
      .map(([catName, total]) => `- ${catName}: ${total.toLocaleString()}원 (지출의 ${Math.round((total / (expense || 1)) * 100)}%)`)
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
          content: '당신은 개인 재무 분석 AI입니다. 가계부 데이터를 분석해 통찰력 있는 소비 패턴 리포트를 작성하고, 반드시 JSON 형식으로만 응답하세요.',
        },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.5,
    });

    const raw = response.choices[0].message.content ?? '{}';
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const insights = Array.isArray(parsed['insights'])
      ? (parsed['insights'] as unknown[]).map((item) => {
          const obj = (item ?? {}) as Record<string, unknown>;
          const tone: InsightTone = obj['tone'] === 'warning' || obj['tone'] === 'danger' ? obj['tone'] : 'green';
          return { tone, text: String(obj['text'] ?? '') };
        })
      : [];
    const tags = Array.isArray(parsed['tags']) ? (parsed['tags'] as unknown[]).map(String) : [];

    const created = await this.prisma.aiReport.create({
      data: {
        user_id: userId,
        period_label: label,
        period_from: from,
        period_to: to,
        model_used: model,
        summary: String(parsed['summary'] ?? ''),
        insights: insights as unknown as Prisma.InputJsonValue,
        tags: tags as unknown as Prisma.InputJsonValue,
      },
    });
    return this.toDto(created);
  }
}
