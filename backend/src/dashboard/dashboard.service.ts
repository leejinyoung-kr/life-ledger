import { Injectable } from '@nestjs/common';
import { AssetService } from '../asset/asset.service';
import { PrismaService } from '../prisma/prisma.service';
import { todayKst } from '../common/kst-date';
import { PriceLookupService } from '../investment/price-lookup.service';

// 주기별 금액을 월 단위로 환산 (yearly/12, weekly*52/12, daily는 평일만(연 261일)*261/12, monthly 그대로)
function toMonthly(amount: number, cycle: string): number {
  if (cycle === 'yearly') return amount / 12;
  if (cycle === 'weekly') return (amount * 52) / 12;
  if (cycle === 'daily') return (amount * 261) / 12;
  return amount;
}

@Injectable()
export class DashboardService {
  constructor(
    private prisma: PrismaService,
    private assetService: AssetService,
    private priceLookup: PriceLookupService,
  ) {}

  // 대시보드 요약 — 이번 달 수입/지출·순자산·활성구독 + 최근거래·다가오는일정
  async summary(userId: number) {
    const today = todayKst();
    const y = today.getUTCFullYear();
    const m = today.getUTCMonth();
    const monthStart = new Date(Date.UTC(y, m, 1));
    const monthEnd = new Date(Date.UTC(y, m + 1, 1));

    const [byType, assetSummary, activeSubs, recent, upcoming] = await Promise.all([
      this.prisma.transaction.groupBy({
        by: ['type'],
        where: { user_id: userId, deleted_at: null, date: { gte: monthStart, lt: monthEnd } },
        _sum: { amount: true },
      }),
      this.assetService.summary(userId),
      // 활성 구독 = 결제 중 + 무료 체험(곧 결제된다 — 구독 화면 · 현금흐름 예측과 같은 기준)
      this.prisma.subscription.groupBy({
        by: ['status'],
        where: { user_id: userId, deleted_at: null, status: { in: ['active', 'trial'] } },
        _count: { _all: true },
      }),
      this.prisma.transaction.findMany({
        where: { user_id: userId, deleted_at: null },
        orderBy: [{ date: 'desc' }, { id: 'desc' }],
        take: 5,
      }),
      this.prisma.calendarEvent.findMany({
        where: { user_id: userId, deleted_at: null, date: { gte: today } },
        orderBy: { date: 'asc' },
        take: 4,
      }),
    ]);

    const sumType = (t: string) => byType.find((g) => g.type === t)?._sum.amount?.toNumber() ?? 0;
    const netWorth = assetSummary.netWorth;
    const subCount = (s: string) => activeSubs.find((g) => g.status === s)?._count._all ?? 0;

    return {
      stats: {
        income: sumType('income'),
        expense: sumType('expense'),
        netWorth,
        activeSubs: subCount('active') + subCount('trial'),
        trialSubs: subCount('trial'),
      },
      recent: recent.map((r) => ({ type: r.type, title: r.title, amount: r.amount.toNumber(), date: r.date.toISOString().slice(0, 10) })),
      upcoming: upcoming.map((u) => ({ type: u.type, title: u.title, date: u.date.toISOString().slice(0, 10) })),
    };
  }

  // 현금흐름 예측 — 활성 구독 + 자동이체 설정된 반복 지출을 월 단위로 환산·합산해 다음 달 고정지출을 추정
  async cashflowForecast(userId: number) {
    const [subs, recurring] = await Promise.all([
      this.prisma.subscription.findMany({
        where: { user_id: userId, deleted_at: null, status: { in: ['active', 'trial'] } },
      }),
      this.prisma.recurringSchedule.findMany({
        where: { user_id: userId, deleted_at: null, kind: 'transaction', active: true, tx_type: 'expense' },
      }),
    ]);

    // USD 구독이 하나라도 있을 때만 환율 조회 (구독 요약과 동일한 방식 — 행마다 호출하지 않고 1회만 재사용)
    const hasUsd = subs.some((s) => s.currency === 'USD');
    const usdToKrwRate = hasUsd ? await this.priceLookup.getExchangeRate('USD', 'KRW') : 1;

    // 구독: USD면 원화 환산 후 주기 환산 (표시용 amount/currency는 원래 통화 유지)
    const subItems = subs.map((s) => {
      const amount = s.amount.toNumber();
      const krwAmount = s.currency === 'USD' ? amount * usdToKrwRate : amount;
      return { name: s.name, kind: 'subscription' as const, cycle: s.cycle, amount, currency: s.currency, monthly: toMonthly(krwAmount, s.cycle) };
    });

    // 자동이체 설정된 반복 지출 — 월 환산 (원화만 지원)
    const recItems = recurring.map((r) => {
      const amount = r.amount?.toNumber() ?? 0;
      const cycle = (r.rule as { cycle?: string } | null)?.cycle ?? 'monthly';
      return { name: r.title ?? '', kind: 'recurring' as const, cycle, amount, currency: 'KRW' as const, monthly: toMonthly(amount, cycle) };
    });

    const subMonthly = subItems.reduce((s, i) => s + i.monthly, 0);
    const recMonthly = recItems.reduce((s, i) => s + i.monthly, 0);
    const items = [...subItems, ...recItems].sort((a, b) => b.monthly - a.monthly);

    return {
      totalMonthly: Math.round(subMonthly + recMonthly),
      subscriptions: { count: subItems.length, monthly: Math.round(subMonthly) },
      recurring: { count: recItems.length, monthly: Math.round(recMonthly) },
      items: items.map((i) => ({ ...i, monthly: Math.round(i.monthly) })),
    };
  }

  // 통합 D-day 보드 — 예적금 만기·구독 결제·할일 마감을 한 목록으로 집계(임박순)
  async deadlines(userId: number, withinDays = 90) {
    const today = todayKst();
    const until = new Date(today);
    until.setUTCDate(until.getUTCDate() + withinDays);
    const range = { gte: today, lte: until };

    const [savings, isaAccounts, subs] = await Promise.all([
      this.prisma.saving.findMany({ where: { user_id: userId, deleted_at: null, maturity_date: range }, select: { name: true, maturity_date: true } }),
      this.prisma.investmentAccount.findMany({ where: { user_id: userId, deleted_at: null, maturity_date: range }, select: { name: true, maturity_date: true } }),
      this.prisma.subscription.findMany({ where: { user_id: userId, deleted_at: null, next_payment_date: range }, select: { name: true, next_payment_date: true, status: true } }),
    ]);

    const DAY = 86400000;
    const dday = (d: Date) => Math.round((Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - today.getTime()) / DAY);
    type Item = { kind: 'saving' | 'investment' | 'subscription'; title: string; date: string; dday: number };
    const items: Item[] = [
      ...savings.map((s) => ({ kind: 'saving' as const, title: `${s.name} 만기`, date: s.maturity_date!.toISOString().slice(0, 10), dday: dday(s.maturity_date!) })),
      ...isaAccounts.map((a) => ({ kind: 'investment' as const, title: `${a.name} 만기`, date: a.maturity_date!.toISOString().slice(0, 10), dday: dday(a.maturity_date!) })),
      ...subs.map((s) => ({ kind: 'subscription' as const, title: `${s.name} ${s.status === 'trial' ? '체험 종료' : '결제'}`, date: s.next_payment_date.toISOString().slice(0, 10), dday: dday(s.next_payment_date) })),
    ];
    return items.sort((a, b) => a.dday - b.dday);
  }
}
