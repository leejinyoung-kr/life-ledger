import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { AssetService } from '../asset/asset.service';
import { SystemLogService } from '../system-log/system-log.service';

// 매주 월요일 새벽 1시 — 전월 순자산(총자산/총부채)·현금 총액을 스냅샷으로 저장해 추이 차트와
// 자산 요약 API의 델타 계산 기준점(cash_total)으로 쓴다. upsert라 같은 달엔 실행할 때마다 덮어쓰며,
// 월 단위가 아닌 주 단위로 재실행하는 이유는 전월(마감된 달)의 뒤늦은 거래 수정 반영 주기를
// 최대 한 달에서 최대 일주일로 줄이기 위함 — 언제 돌든 "직전 달"을 다시 통째로 재계산하므로 자연 치유됨.
@Injectable()
export class NetWorthSnapshotCronService {
  private readonly logger = new Logger(NetWorthSnapshotCronService.name);

  constructor(
    private prisma: PrismaService,
    private assetService: AssetService,
    private sysLog: SystemLogService,
  ) {}

  @Cron('0 1 * * 1')
  async snapshotMonthly(): Promise<void> {
    const users = await this.prisma.user.findMany({ select: { id: true } });

    // 실행 시점 기준 전월(YYYY-MM)을 스냅샷 키로 사용 — 매주 재계산되므로 이번 달 안에서는 항상 같은 키
    const now = new Date();
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const month = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`;

    let ok = 0;
    for (const u of users) {
      try {
        const summary = await this.assetService.summary(u.id);
        // cash_total은 summary()의 델타 계산 기준점이 되므로 전체 재집계로 정확히 저장 — 지난달치 뒤늦은 수정도 여기서 자연 치유됨
        const cashTotal = await this.assetService.cashTotalForSnapshot(u.id, month);
        await this.prisma.netWorthSnapshot.upsert({
          where: { user_id_month: { user_id: u.id, month } },
          create: { user_id: u.id, month, total_assets: summary.totalAssets, total_debt: summary.totalDebt, cash_total: cashTotal },
          update: { total_assets: summary.totalAssets, total_debt: summary.totalDebt, cash_total: cashTotal },
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
