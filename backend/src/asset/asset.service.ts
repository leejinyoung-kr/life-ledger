import { Injectable } from '@nestjs/common';
import { Prisma, TransactionType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PriceLookupService } from '../investment/price-lookup.service';
import { SystemLogService } from '../system-log/system-log.service';

type SummaryType = 'cash' | 'savings' | 'investment';

@Injectable()
export class AssetService {
  constructor(
    private prisma: PrismaService,
    private priceLookup: PriceLookupService,
    private sysLog: SystemLogService,
  ) {}

  // 'YYYY-MM' 다음달 1일 — 그 달 말까지 포함하는 배타적 상한 경계(스냅샷 컷오프)
  private firstDayOfMonthAfter(month: string): Date {
    const [y, m] = month.split('-').map(Number);
    return new Date(Date.UTC(y, m, 1));
  }

  // 현금 흐름 합계(수입-지출) — dateFilter 지정 시 해당 구간만. 월말 스냅샷 저장·실시간 델타 계산에 공용 사용
  private async cashFlowSum(userId: number, dateFilter?: Prisma.DateTimeFilter): Promise<number> {
    const where = (type: TransactionType): Prisma.TransactionWhereInput => ({
      user_id: userId,
      deleted_at: null,
      type,
      ...(dateFilter ? { date: dateFilter } : {}),
    });
    const [incAgg, expAgg] = await Promise.all([
      this.prisma.transaction.aggregate({ where: where('income'), _sum: { amount: true } }),
      this.prisma.transaction.aggregate({ where: where('expense'), _sum: { amount: true } }),
    ]);
    return (incAgg._sum.amount?.toNumber() ?? 0) - (expAgg._sum.amount?.toNumber() ?? 0);
  }

  // 특정 월 말 기준 누적 현금 총액 — 월간 순자산 스냅샷 저장용(NetWorthSnapshotCronService)
  async cashTotalForSnapshot(userId: number, month: string): Promise<number> {
    return this.cashFlowSum(userId, { lt: this.firstDayOfMonthAfter(month) });
  }

  // 요약 — 총자산/순자산 + 전월 대비 증감 + 도넛 구성 + 유형별 집계
  // 예적금 → Saving.balance, 투자 → Investment.current_value, 현금 → 수입-지출
  async summary(userId: number) {
    // 서로 의존성 없는 조회는 한 번에 병렬 실행 (TiDB Cloud 왕복 지연 누적 방지)
    const [savings, investments, investmentAccounts, prevSnap] =
      await Promise.all([
        this.prisma.saving.findMany({
          where: { user_id: userId, deleted_at: null },
          select: { balance: true, interest_rate: true },
        }),
        this.prisma.investment.findMany({
          where: { user_id: userId, deleted_at: null },
          select: { current_value: true },
        }),
        this.prisma.investmentAccount.findMany({
          where: { user_id: userId, deleted_at: null },
          select: { cash_balance: true, cash_balance_usd: true },
        }),
        this.prisma.netWorthSnapshot.findFirst({
          where: { user_id: userId, month: { lt: new Date().toISOString().slice(0, 7) } },
          orderBy: { month: 'desc' },
        }),
      ]);

    // 현금 총액 = 직전 월말 스냅샷 캐시값 + 그 이후 거래 델타(전체 재집계 대신 이번 달치만 스캔).
    // 스냅샷에 캐시값이 없으면(첫 크론 이전 신규 사용자 등) 전체 재집계로 폴백.
    const cashTotal =
      prevSnap?.cash_total != null
        ? prevSnap.cash_total.toNumber() +
          (await this.cashFlowSum(userId, { gte: this.firstDayOfMonthAfter(prevSnap.month) }))
        : await this.cashFlowSum(userId);

    const savingsTotal = savings.reduce((s, r) => s + r.balance.toNumber(), 0);
    const savingsAvgRate = savings.length
      ? Math.round(
          (savings.reduce((s, r) => s + r.interest_rate.toNumber(), 0) / savings.length) * 100,
        ) / 100
      : null;

    // 달러 예수금은 환율 적용해 원화로 환산 (미투자 대기 현금도 자산이므로 합산)
    const usdTotal = investmentAccounts.reduce((s, r) => s + r.cash_balance_usd.toNumber(), 0);
    const usdToKrw = usdTotal
      ? await this.priceLookup.getExchangeRate('USD', 'KRW').catch((e: unknown) => {
          this.sysLog.warn({ userId, category: 'asset', message: '달러 환율 조회 실패 — 달러 자산 0원 처리', metadata: { error: (e as Error).message, usdAmount: usdTotal } });
          return 0;
        })
      : 0;
    const investTotal =
      investments.reduce((s, r) => s + r.current_value.toNumber(), 0) +
      investmentAccounts.reduce((s, r) => s + r.cash_balance.toNumber(), 0) +
      Math.round(usdTotal * usdToKrw);

    const totalAssets = cashTotal + savingsTotal + investTotal;
    const netWorth = totalAssets;

    // 도넛 구성 — 자산 유형별 비중(%)
    const allocation = [
      { type: 'cash' as SummaryType, amount: cashTotal },
      { type: 'savings' as SummaryType, amount: savingsTotal },
      { type: 'investment' as SummaryType, amount: investTotal },
    ]
      .filter((a) => a.amount > 0)
      .map((a) => ({
        type: a.type,
        amount: a.amount,
        percent: totalAssets > 0 ? Math.round((a.amount / totalAssets) * 100) : 0,
      }));

    // 유형별 카드
    const byType = [
      { type: 'cash' as SummaryType, amount: cashTotal, count: cashTotal > 0 ? 1 : 0, avgRate: null },
      { type: 'savings' as SummaryType, amount: savingsTotal, count: savings.length, avgRate: savingsAvgRate },
      { type: 'investment' as SummaryType, amount: investTotal, count: investments.length, avgRate: null },
    ].filter((b) => b.amount > 0 || b.count > 0);

    // 전월 대비 증감 — 과거 스냅샷은 부채 추적 종료 이전 기록일 수 있어 total_debt를 그대로 반영해 비교
    let changeAmount = 0;
    let changeRate = 0;
    if (prevSnap) {
      const prevNet = prevSnap.total_assets.toNumber() - prevSnap.total_debt.toNumber();
      changeAmount = netWorth - prevNet;
      changeRate = prevNet !== 0 ? Math.round((changeAmount / prevNet) * 1000) / 10 : 0;
    }

    return { totalAssets, netWorth, changeAmount, changeRate, allocation, byType };
  }

  // 순자산 추이 — 최근 6개월 스냅샷 (월 오름차순)
  async trend(userId: number) {
    const snaps = await this.prisma.netWorthSnapshot.findMany({
      where: { user_id: userId },
      orderBy: { month: 'desc' },
      take: 6,
    });
    const latest = snaps[0]?.month;
    return snaps
      .reverse()
      .map((s) => ({
        month: s.month,
        label: `${Number(s.month.slice(5))}월`,
        netWorth: s.total_assets.toNumber() - s.total_debt.toNumber(),
        current: s.month === latest,
      }));
  }
}
