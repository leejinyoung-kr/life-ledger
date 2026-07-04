import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { SecurityService } from '../security/security.service';
import { SystemLogService } from '../system-log/system-log.service';

// 보안 점수 추이용 일별 스냅샷 적재 (전 사용자) — 알림 크론과 같은 9시대에 1건씩 저장
@Injectable()
export class SecuritySnapshotCronService {
  private readonly logger = new Logger(SecuritySnapshotCronService.name);

  constructor(
    private prisma: PrismaService,
    private security: SecurityService,
    private sysLog: SystemLogService,
  ) {}

  // 매일 오전 9시 — 사용자별 보안 점수 1건 적재(같은 날 재실행 시 갱신)
  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async snapshotAll(): Promise<void> {
    const users = await this.prisma.user.findMany({ select: { id: true } });
    let ok = 0;
    for (const u of users) {
      try {
        await this.security.snapshot(u.id);
        ok++;
      } catch (e) {
        this.logger.warn(`보안점수 스냅샷 실패(user ${u.id}): ${(e as Error).message}`);
        this.sysLog.error({ userId: u.id, category: 'security', message: '보안점수 스냅샷 저장 실패', metadata: { error: (e as Error).message } });
      }
    }
    if (ok) {
      this.logger.log(`보안점수 스냅샷 ${ok}건 적재`);
      this.sysLog.info({ category: 'security', message: `보안점수 스냅샷 ${ok}건 적재`, metadata: { total: users.length, ok } });
    }
  }
}
