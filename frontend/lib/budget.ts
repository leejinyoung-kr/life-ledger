/**
 * 예산 API 타입 및 호출 함수.
 * GET  /budget/status?month=YYYY-MM  — 월별 현황
 * GET  /budget/history               — 최근 6개월 히스토리
 * POST /budget                       — 월별 오버라이드 저장
 * POST /budget/carryover?month=      — 이월 적용
 * DELETE /budget/carryover?month=    — 이월 초기화
 */
import { api, apiFetch } from './api';

export interface BudgetCategoryStatus {
  category: string;
  label: string;
  budget: number;
  defaultBudget: number;
  carriedOver: number;
  spent: number;
  remaining: number;
  percent: number;
  isOver: boolean;
  isOverridden: boolean;
}

export interface BudgetSummary {
  totalBudget: number;
  totalCarriedOver: number;
  totalSpent: number;
  totalRemaining: number;
  overCount: number;
}

export interface BudgetMonthStatus {
  summary: BudgetSummary;
  categories: BudgetCategoryStatus[];
}

export interface BudgetHistoryItem {
  month: string;
  budgeted: number;
  spent: number;
  carriedOver: number;
}

export const budgetApi = {
  getStatus: (month: string) =>
    api.get<BudgetMonthStatus>(`/budget/status?month=${month}`),

  getHistory: () =>
    api.get<BudgetHistoryItem[]>('/budget/history'),

  upsert: (month: string, items: { category: string; amount: number }[]) =>
    api.post<BudgetMonthStatus>('/budget', { month, items }),

  applyCarryover: (month: string) =>
    apiFetch<{ ok: boolean }>(`/budget/carryover?month=${month}`, { method: 'POST' }),

  resetCarryover: (month: string) =>
    apiFetch<{ ok: boolean }>(`/budget/carryover?month=${month}`, { method: 'DELETE' }),
};

// 현재 달 YYYY-MM 반환
export function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

// 이전 달 YYYY-MM 반환
export function prevMonth(month: string): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function fmtMoney(v: number): string {
  return v.toLocaleString('ko-KR');
}
