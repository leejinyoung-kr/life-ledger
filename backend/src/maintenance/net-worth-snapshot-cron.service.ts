import { Injectable, Logger } from '@nestjs/common';
import { Job } from '@leejinyoung-kr/core-jobs';
import { PrismaService } from '../prisma/prisma.service';
import { AssetService } from '../asset/asset.service';
import { SystemLogService } from '../system-log/system-log.service';
import { kstMonthStr } from '../common/kst-date';
import { finishPerUser } from './job-result';

// 매일 새벽 1시 — 어제가 속한 달(YYYY-MM)의 순자산·현금 총액을 스냅샷으로 저장해 추이 차트와
// 자산 요약 API의 전월 대비·델타 계산 기준점(cash_total)으로 쓴다. upsert라 같은 달엔 매일 덮어쓰므로
// 그 달의 마지막 저장(다음 달 1일 새벽)이 곧 월말 값이 된다. 예적금·투자는 이력이 없어 "지금 값"만
// 찍을 수 있으니, 이름표는 반드시 값을 찍은 시점의 달이어야 한다(2026-10 이전엔 지난달 이름에 이번 달 값을 덮어썼다).
@Injectable()
export class NetWorthSnapshotCronService {
  private readonly logger = new Logger(NetWorthSnapshotCronService.name);

  constructor(
    private prisma: PrismaService,
    private assetService: AssetService,
    private sysLog: SystemLogService,
  ) {}

  @Job({ name: 'net-worth-snapshot', cron: '0 1 * * *', leaseMs: 10 * 60_000 })
  async snapshotMonthly(): Promise<string> {
    const users = await this.prisma.user.findMany({ select: { id: true } });

    // 새벽 1시 값 ≈ 어제 끝 값 — 1일 새벽 실행이 지난달 월말 값을 확정한다
    const month = kstMonthStr(new Date(Date.now() - 24 * 60 * 60_000));

    let ok = 0;
    for (const u of users) {
      try {
        const summary = await this.assetService.summary(u.id);
        // cash_total은 summary()의 델타 계산 기준점이 되므로 전체 재집계로 정확히 저장 — 뒤늦은 거래 수정도 여기서 자연 치유됨
        // total_debt: 부채(자산관리) 기능 제거 이후로는 항상 0 — 과거 스냅샷의 기록값은 그대로 유지
        const cashTotal = await this.assetService.cashTotalForSnapshot(u.id, month);
        await this.prisma.netWorthSnapshot.upsert({
          where: { user_id_month: { user_id: u.id, month } },
          create: { user_id: u.id, month, total_assets: summary.totalAssets, total_debt: 0, cash_total: cashTotal },
          update: { total_assets: summary.totalAssets, total_debt: 0, cash_total: cashTotal },
        });
        ok++;
      } catch (e) {
        this.logger.warn(`순자산 스냅샷 실패(user ${u.id}): ${(e as Error).message}`);
        this.sysLog.error({ userId: u.id, category: 'asset', message: '순자산 스냅샷 저장 실패', metadata: { month, error: (e as Error).message } });
      }
    }

    if (ok) {
      this.sysLog.info({ category: 'asset', message: `순자산 스냅샷 ${ok}건 저장 (${month})`, metadata: { month, total: users.length, ok } });
    }
    return finishPerUser(`순자산 스냅샷 ${ok}/${users.length}명 저장 (${month})`, users.length - ok);
  }
}
