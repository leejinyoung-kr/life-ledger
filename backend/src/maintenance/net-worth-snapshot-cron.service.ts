import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { AssetService } from '../asset/asset.service';
import { SystemLogService } from '../system-log/system-log.service';

// 매월 1일 새벽 1시 — 전월 순자산(총자산/총부채)을 스냅샷으로 저장해 추이 차트에 활용한다.
// 같은 달에 재실행되면 upsert 로 덮어쓴다.
@Injectable()
export class NetWorthSnapshotCronService {
  private readonly logger = new Logger(NetWorthSnapshotCronService.name);

  constructor(
    private prisma: PrismaService,
    private assetService: AssetService,
    private sysLog: SystemLogService,
  ) {}

  @Cron('0 1 1 * *')
  async snapshotMonthly(): Promise<void> {
    const users = await this.prisma.user.findMany({ select: { id: true } });

    // 크론 실행 시점은 매월 1일 — 전월(YYYY-MM)을 스냅샷 키로 사용
    const now = new Date();
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const month = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`;

    let ok = 0;
    for (const u of users) {
      try {
        const summary = await this.assetService.summary(u.id);
        await this.prisma.netWorthSnapshot.upsert({
          where: { user_id_month: { user_id: u.id, month } },
          create: { user_id: u.id, month, total_assets: summary.totalAssets, total_debt: summary.totalDebt },
          update: { total_assets: summary.totalAssets, total_debt: summary.totalDebt },
        });
        ok++;
      } catch (e) {
        this.logger.warn(`순자산 스냅샷 실패(user ${u.id}): ${(e as Error).message}`);
        this.sysLog.error({ userId: u.id, category: 'asset', message: '순자산 스냅샷 저장 실패', metadata: { month, error: (e as Error).message } });
      }
    }

    if (ok) {
      this.logger.log(`순자산 스냅샷 ${ok}건 저장 (${month})`);
      this.sysLog.info({ category: 'asset', message: `순자산 스냅샷 ${ok}건 저장 (${month})`, metadata: { month, total: users.length, ok } });
    }
  }
}
