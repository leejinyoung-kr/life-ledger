import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// 주기별 금액을 월 단위로 환산 (yearly/12, weekly*52/12, monthly 그대로)
function toMonthly(amount: number, cycle: string): number {
  if (cycle === 'yearly') return amount / 12;
  if (cycle === 'weekly') return (amount * 52) / 12;
  return amount;
}

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  // 대시보드 요약 — 이번 달 수입/지출·순자산·활성구독 + 카테고리 예산·최근거래·다가오는일정
  async summary(userId: number) {
    const now = new Date();
    const y = now.getUTCFullYear();
    const m = now.getUTCMonth();
    const monthStart = new Date(Date.UTC(y, m, 1));
    const monthEnd = new Date(Date.UTC(y, m + 1, 1));
    const today = new Date(Date.UTC(y, m, now.getUTCDate()));

    const monthStr = `${y}-${String(m + 1).padStart(2, '0')}`;

    const [byType, byCat, assets, activeSubs, settings, overrides, recent, upcoming] = await Promise.all([
      this.prisma.transaction.groupBy({
        by: ['type'],
        where: { user_id: userId, deleted_at: null, date: { gte: monthStart, lt: monthEnd } },
        _sum: { amount: true },
      }),
      this.prisma.transaction.groupBy({
        by: ['category'],
        where: { user_id: userId, deleted_at: null, type: 'expense', date: { gte: monthStart, lt: monthEnd } },
        _sum: { amount: true },
      }),
      this.prisma.asset.findMany({ where: { user_id: userId, deleted_at: null }, select: { type: true, amount: true } }),
      this.prisma.subscription.count({ where: { user_id: userId, deleted_at: null, status: 'active' } }),
      this.prisma.userSettings.findUnique({ where: { user_id: userId }, select: { budgets: true } }),
      this.prisma.monthlyBudget.findMany({ where: { user_id: userId, year_month: monthStr } }),
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
    const netWorth = assets.reduce((s, a) => (a.type === 'debt' ? s - a.amount.toNumber() : s + a.amount.toNumber()), 0);

    // 기본 예산에 이번 달 오버라이드(월별 예산) 병합 — 오버라이드 있으면 우선 적용
    const defaultBudgets = (settings?.budgets as Record<string, number> | null) ?? {};
    const overrideMap = new Map(overrides.map((o) => [o.category, o]));
    const allCats = new Set([...Object.keys(defaultBudgets), ...overrides.map((o) => o.category)]);
    const budgets = [...allCats].map((category) => {
      const defaultAmt = defaultBudgets[category] ?? 0;
      const override = overrideMap.get(category);
      const carriedOver = override ? override.carried_over_amount : 0;
      const budget = (override ? override.amount : defaultAmt) + carriedOver;
      const spent = Number(byCat.find((c) => c.category === category)?._sum.amount ?? 0);
      return { category, spent, budget, percent: budget ? Math.round((spent / budget) * 100) : 0 };
    });

    return {
      stats: {
        income: sumType('income'),
        expense: sumType('expense'),
        netWorth,
        activeSubs,
      },
      budgets,
      recent: recent.map((r) => ({ type: r.type, title: r.title, amount: r.amount.toNumber(), date: r.date.toISOString().slice(0, 10) })),
      upcoming: upcoming.map((u) => ({ type: u.type, title: u.title, date: u.date.toISOString().slice(0, 10) })),
    };
  }

  // 현금흐름 예측 — 활성 구독 + 반복 지출거래를 월 단위로 환산·합산해 다음 달 고정지출을 추정
  async cashflowForecast(userId: number) {
    const [subs, recurring] = await Promise.all([
      this.prisma.subscription.findMany({
        where: { user_id: userId, deleted_at: null, status: { in: ['active', 'trial'] } },
      }),
      this.prisma.transaction.findMany({
        where: { user_id: userId, deleted_at: null, is_recurring: true, type: 'expense' },
        orderBy: { date: 'desc' },
      }),
    ]);

    // 구독: 주기 환산
    const subItems = subs.map((s) => {
      const amount = s.amount.toNumber();
      return { name: s.name, kind: 'subscription' as const, cycle: s.cycle, amount, monthly: toMonthly(amount, s.cycle) };
    });

    // 반복 지출: 동일 규칙(제목·카테고리·금액)은 1건만 — recurring 회차 중복 제거
    const seen = new Set<string>();
    const recItems = recurring
      .filter((r) => {
        const key = `${r.title}|${r.category}|${r.amount}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map((r) => {
        const amount = r.amount.toNumber();
        const cycle = (r.recurring_rule as { cycle?: string } | null)?.cycle ?? 'monthly';
        return { name: r.title, kind: 'recurring' as const, cycle, amount, monthly: toMonthly(amount, cycle) };
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
}
