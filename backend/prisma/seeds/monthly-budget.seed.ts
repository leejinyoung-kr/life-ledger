/**
 * MonthlyBudget 더미 — 월별 예산 오버라이드 + 이월 데이터.
 *
 * 시나리오:
 *  - 2026-04: 교통비를 특별히 20만원으로 올림 (벚꽃 여행)
 *  - 2026-05: 구독 줄이고 전달(4월) 교통 잔액 4만원 이월됨
 *  - 2026-06(이번달): 쇼핑 예산 늘리고 전달(5월) 식비 잔액 3만원 이월됨
 */
import type { SeedFn } from './helpers';

interface BudgetRow {
  year_month: string;
  category: string;
  amount: number;
  carried_over_amount: number;
}

const ROWS: BudgetRow[] = [
  // ── 2026-04: 교통비 특별 증액 (기본 150,000 → 200,000) ──
  { year_month: '2026-04', category: 'transport',    amount: 200000, carried_over_amount:  0 },

  // ── 2026-05: 구독 삭감 + 4월 교통 잔액 이월 ──
  { year_month: '2026-05', category: 'subscription', amount: 120000, carried_over_amount:      0 },
  { year_month: '2026-05', category: 'transport',    amount:      0, carried_over_amount:  40000 }, // 이월만

  // ── 2026-06(이번달): 쇼핑 증액 + 5월 식비 잔액 이월 ──
  { year_month: '2026-06', category: 'shopping',     amount: 450000, carried_over_amount:      0 },
  { year_month: '2026-06', category: 'food',         amount:      0, carried_over_amount:  30000 }, // 이월만
];

export const seedMonthlyBudget: SeedFn = async (prisma, userId) => {
  await prisma.monthlyBudget.deleteMany({ where: { user_id: userId } });

  await prisma.monthlyBudget.createMany({
    data: ROWS.map((r) => ({ ...r, user_id: userId })),
  });

  return ROWS.length;
};
