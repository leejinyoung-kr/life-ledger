import { Injectable } from '@nestjs/common';
import { AssetService } from '../asset/asset.service';
import { PrismaService } from '../prisma/prisma.service';

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
  ) {}

  // 대시보드 요약 — 이번 달 수입/지출·순자산·활성구독 + 최근거래·다가오는일정
  async summary(userId: number) {
    const now = new Date();
    const y = now.getUTCFullYear();
    const m = now.getUTCMonth();
    const monthStart = new Date(Date.UTC(y, m, 1));
    const monthEnd = new Date(Date.UTC(y, m + 1, 1));
    const today = new Date(Date.UTC(y, m, now.getUTCDate()));

    const [byType, assetSummary, activeSubs, recent, upcoming] = await Promise.all([
      this.prisma.transaction.groupBy({
        by: ['type'],
        where: { user_id: userId, deleted_at: null, date: { gte: monthStart, lt: monthEnd } },
        _sum: { amount: true },
      }),
      this.assetService.summary(userId),
      this.prisma.subscription.count({ where: { user_id: userId, deleted_at: null, status: 'active' } }),
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

    return {
      stats: {
        income: sumType('income'),
        expense: sumType('expense'),
        netWorth,
        activeSubs,
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

    // 구독: 주기 환산
    const subItems = subs.map((s) => {
      const amount = s.amount.toNumber();
      return { name: s.name, kind: 'subscription' as const, cycle: s.cycle, amount, monthly: toMonthly(amount, s.cycle) };
    });

    // 자동이체 설정된 반복 지출 — 월 환산
    const recItems = recurring.map((r) => {
      const amount = r.amount?.toNumber() ?? 0;
      const cycle = (r.rule as { cycle?: string } | null)?.cycle ?? 'monthly';
      return { name: r.title ?? '', kind: 'recurring' as const, cycle, amount, monthly: toMonthly(amount, cycle) };
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

  // 통합 D-day 보드 — 신원 만료·예적금 만기·구독 결제·할일 마감을 한 목록으로 집계(임박순)
  async deadlines(userId: number, withinDays = 90) {
    const now = new Date();
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const until = new Date(today);
    until.setUTCDate(until.getUTCDate() + withinDays);
    const range = { gte: today, lte: until };

    const [ids, savings, subs, tasks] = await Promise.all([
      this.prisma.identityCard.findMany({ where: { user_id: userId, deleted_at: null, expire_date: range }, select: { name: true, expire_date: true } }),
      this.prisma.saving.findMany({ where: { user_id: userId, deleted_at: null, maturity_date: range }, select: { name: true, maturity_date: true } }),
      this.prisma.subscription.findMany({ where: { user_id: userId, deleted_at: null, next_payment_date: range }, select: { name: true, next_payment_date: true, status: true } }),
      this.prisma.task.findMany({ where: { user_id: userId, deleted_at: null, done: false, due_date: range }, select: { text: true, due_date: true } }),
    ]);

    const DAY = 86400000;
    const dday = (d: Date) => Math.round((Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - today.getTime()) / DAY);
    type Item = { kind: 'identity' | 'saving' | 'subscription' | 'task'; title: string; date: string; dday: number };
    const items: Item[] = [
      ...ids.map((i) => ({ kind: 'identity' as const, title: `${i.name} 만료`, date: i.expire_date!.toISOString().slice(0, 10), dday: dday(i.expire_date!) })),
      ...savings.map((s) => ({ kind: 'saving' as const, title: `${s.name} 만기`, date: s.maturity_date!.toISOString().slice(0, 10), dday: dday(s.maturity_date!) })),
      ...subs.map((s) => ({ kind: 'subscription' as const, title: `${s.name} ${s.status === 'trial' ? '체험 종료' : '결제'}`, date: s.next_payment_date.toISOString().slice(0, 10), dday: dday(s.next_payment_date) })),
      ...tasks.map((t) => ({ kind: 'task' as const, title: `${t.text} 마감`, date: t.due_date!.toISOString().slice(0, 10), dday: dday(t.due_date!) })),
    ];
    return items.sort((a, b) => a.dday - b.dday);
  }
}
