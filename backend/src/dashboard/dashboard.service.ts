import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

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

    const [byType, byCat, assets, activeSubs, settings, recent, upcoming] = await Promise.all([
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

    const budgetMap = (settings?.budgets as Record<string, number> | null) ?? {};
    const budgets = Object.entries(budgetMap).map(([category, budget]) => {
      const spent = byCat.find((c) => c.category === category)?._sum.amount?.toNumber() ?? 0;
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
}
