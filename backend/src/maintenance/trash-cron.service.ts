import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TrashCronService {
  private readonly logger = new Logger(TrashCronService.name);

  constructor(private prisma: PrismaService) {}

  // 매일 새벽 3시 — soft-delete 후 30일 경과 항목 영구 삭제
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async purgeExpired(): Promise<void> {
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const where = { deleted_at: { lt: cutoff } } as const;
    let total = 0;

    // 독립 테이블 (user FK 만) — 개별 삭제
    const simple = [
      () => this.prisma.transaction.deleteMany({ where }),
      () => this.prisma.saving.deleteMany({ where }),
      () => this.prisma.investment.deleteMany({ where }),
      () => this.prisma.subscription.deleteMany({ where }),
      () => this.prisma.asset.deleteMany({ where }),
      () => this.prisma.task.deleteMany({ where }),
      () => this.prisma.note.deleteMany({ where }),
      () => this.prisma.calendarEvent.deleteMany({ where }),
      () => this.prisma.identityCard.deleteMany({ where }),
      () => this.prisma.credential.deleteMany({ where }),
    ];
    for (const del of simple) {
      try { total += (await del()).count; } catch (e) { this.logger.error(`purge 실패: ${(e as Error).message}`); }
    }

    // ENV: 변수(FK) 먼저 정리 후 프로젝트 — 만료 프로젝트의 잔여 변수까지 제거
    try {
      total += (await this.prisma.envVar.deleteMany({ where })).count;
      const oldProjects = await this.prisma.envProject.findMany({ where, select: { id: true } });
      const ids = oldProjects.map((p) => p.id);
      if (ids.length) {
        await this.prisma.envVar.deleteMany({ where: { project_id: { in: ids } } });
        total += (await this.prisma.envProject.deleteMany({ where: { id: { in: ids } } })).count;
      }
    } catch (e) {
      this.logger.error(`ENV purge 실패: ${(e as Error).message}`);
    }

    if (total) this.logger.log(`휴지통 영구삭제 ${total}건 (30일 경과)`);

    // 시스템 로그 90일 경과 항목 정리
    try {
      const logCutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
      const { count } = await this.prisma.systemLog.deleteMany({ where: { created_at: { lt: logCutoff } } });
      if (count) this.logger.log(`시스템 로그 ${count}건 삭제 (90일 경과)`);
    } catch (e) {
      this.logger.error(`시스템 로그 정리 실패: ${(e as Error).message}`);
    }
  }
}
