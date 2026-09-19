import { Injectable, Logger } from '@nestjs/common';
import { Job } from '@leejinyoun/core-jobs';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai/ai.service';
import { SystemLogService } from '../system-log/system-log.service';

// 매월 1일 09시 — notif_monthly를 켠 사용자의 전월 AI 리포트 자동 생성.
// OpenAI 키 미설정/오류·분석할 내역 없음 등은 사용자별로 조용히 스킵(다음 달에 재시도) — 예상된 경우가 많아
// 사용자별 실패는 실행 실패로 보지 않고 요약에 건너뜀 건수로만 남긴다
@Injectable()
export class AiReportCronService {
  private readonly logger = new Logger(AiReportCronService.name);

  constructor(
    private prisma: PrismaService,
    private aiService: AiService,
    private sysLog: SystemLogService,
  ) {}

  @Job({ name: 'ai-monthly-report', cron: '0 9 1 * *', leaseMs: 30 * 60_000 })
  async generateMonthlyReports(): Promise<string> {
    const users = await this.prisma.userSettings.findMany({
      where: { notif_monthly: true },
      select: { user_id: true },
    });
    let ok = 0;
    for (const u of users) {
      try {
        await this.aiService.generateReport(u.user_id, 'last_month');
        ok++;
      } catch (e) {
        this.logger.warn(`월간 리포트 자동생성 실패(user ${u.user_id}): ${(e as Error).message}`);
        this.sysLog.warn({ userId: u.user_id, category: 'ai', message: '월간 AI 리포트 자동생성 실패', metadata: { error: (e as Error).message } });
      }
    }
    if (ok) {
      this.sysLog.info({ category: 'ai', message: `월간 AI 리포트 자동생성 완료 ${ok}건`, metadata: { total: users.length, ok } });
    }
    const skipped = users.length - ok;
    return `월간 리포트 ${ok}건 생성 (대상 ${users.length}명${skipped ? `, 건너뜀 ${skipped}명` : ''})`;
  }
}
