import { Injectable, Logger } from '@nestjs/common';
import { Job } from '@leejinyoun/core-jobs';
import { PrismaService } from '../prisma/prisma.service';
import { SecurityService } from '../security/security.service';
import { SystemLogService } from '../system-log/system-log.service';
import { finishPerUser } from './job-result';

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
  @Job({ name: 'security-snapshot', cron: '0 9 * * *', leaseMs: 10 * 60_000 })
  async snapshotAll(): Promise<string> {
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
      this.sysLog.info({ category: 'security', message: `보안점수 스냅샷 ${ok}건 적재`, metadata: { total: users.length, ok } });
    }
    return finishPerUser(`보안점수 스냅샷 ${ok}/${users.length}명 적재`, users.length - ok);
  }
}
