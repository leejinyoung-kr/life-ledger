import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai/ai.service';

// 매월 1일 09시 — notif_monthly를 켠 사용자의 전월 AI 리포트 자동 생성.
// OpenAI 키 미설정/오류·분석할 내역 없음 등은 사용자별로 조용히 스킵(다음 달에 재시도)
@Injectable()
export class AiReportCronService {
  private readonly logger = new Logger(AiReportCronService.name);

  constructor(
    private prisma: PrismaService,
    private aiService: AiService,
  ) {}

  @Cron('0 9 1 * *')
  async generateMonthlyReports(): Promise<void> {
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
      }
    }
    if (ok) this.logger.log(`월간 리포트 자동생성 ${ok}건`);
  }
}
