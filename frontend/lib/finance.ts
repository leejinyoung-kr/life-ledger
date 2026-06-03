/**
 * 가계부(수입/지출·예적금·투자) 공통 타입 · 라벨맵 · 포맷 유틸.
 * 백엔드 응답 DTO 와 1:1 대응한다.
 */

// ── 타입 ────────────────────────────────────────────────────────

// /categories API 응답 DTO
export interface Category {
  id: number;
  domain: string;
  code: string;
  label: string;
  sortOrder: number;
  isActive: boolean;
}

export type TransactionType = 'income' | 'expense' | 'transfer';
export type RecurringCycle = 'monthly' | 'weekly' | 'yearly';
export type WeekendAdjust = 'none' | 'before' | 'after';

export interface RecurringRule {
  cycle: RecurringCycle;
  /** 매월: 1-31일, 매주: 0(일)~6(토), 매년: 1-365 */
  day: number;
  weekendAdjust: WeekendAdjust;
}

export interface Transaction {
  id: number;
  type: TransactionType;
  date: string; // YYYY-MM-DD
  title: string;
  category: string; // 코드
  amount: number;
  payMethod: string;
  memo: string | null;
  isRecurring: boolean;
  recurringRule: RecurringRule | null;
}

export interface TransactionSummary {
  month: string | null;
  income: number;
  expense: number;
  transfer: number;
  realSpend: number;
  balance: number;
}

export interface TrendBucket {
  month: string;
  label: string;
  total: number;
}

export type SavingType = 'savings' | 'deposit' | 'subscription' | 'etc';

export interface Saving {
  id: number;
  bank: string;
  name: string;
  type: SavingType;
  interestRate: number;
  monthlyAmount: number;
  startDate: string;
  maturityDate: string | null;
  balance: number;
  memo: string | null;
}

export interface SavingSummary {
  totalBalance: number;
  monthlyDeposit: number;
  avgRate: number;
  maturityNear: number;
}

export type InvestmentType =
  | 'domestic_stock'
  | 'foreign_stock'
  | 'foreign_etf'
  | 'domestic_etf'
  | 'crypto'
  | 'etc';

export interface Investment {
  id: number;
  name: string;
  type: InvestmentType;
  principal: number;
  currentValue: number;
  profit: number;
  profitRate: number;
  purchaseDate: string;
  memo: string | null;
}

export interface InvestmentSummary {
  totalValue: number;
  totalPrincipal: number;
  totalProfit: number;
  profitRate: number;
}

// ── 라벨맵 (코드 ↔ 화면 표시) ────────────────────────────────────
export const TX_TYPE_LABEL: Record<TransactionType, string> = {
  income: '수입',
  expense: '지출',
  transfer: '자산이동',
};

export const CYCLE_LABEL: Record<RecurringCycle, string> = {
  monthly: '매월',
  weekly: '매주',
  yearly: '매년',
};

export const WEEKEND_ADJUST_LABEL: Record<WeekendAdjust, string> = {
  none: '조정 안 함',
  before: '전 금요일',
  after: '다음 월요일',
};

// 카테고리 코드 → 이모지+한글 칩 라벨
export const CATEGORY_LABEL: Record<string, string> = {
  food: '🍚 식비',
  transport: '🚌 교통',
  subscription: '📺 구독',
  shopping: '🛍️ 쇼핑',
  salary: '💰 급여',
  transfer: '💳 자산이동',
  etc: '📦 기타',
};

// 가계부 입력 폼에서 고르는 카테고리 옵션
export const CATEGORY_OPTIONS: { value: string; label: string }[] = [
  { value: 'food', label: '식비' },
  { value: 'transport', label: '교통' },
  { value: 'subscription', label: '구독' },
  { value: 'shopping', label: '쇼핑' },
  { value: 'salary', label: '급여' },
  { value: 'transfer', label: '자산이동' },
  { value: 'etc', label: '기타' },
];

export const PAY_METHODS = ['신한카드', '카카오페이', '현금', '계좌이체'];

export const SAVING_TYPE_LABEL: Record<SavingType, string> = {
  savings: '적금',
  deposit: '예금',
  subscription: '청약',
  etc: '기타',
};

export const INVEST_TYPE_LABEL: Record<InvestmentType, string> = {
  domestic_stock: '📈 국내주식',
  foreign_stock: '🌎 해외주식',
  foreign_etf: '🌍 해외ETF',
  domestic_etf: '📊 국내ETF',
  crypto: '₿ 가상자산',
  etc: '📦 기타',
};

// ── 포맷 유틸 ────────────────────────────────────────────────────
// 원화 표시 (₩1,234,000)
export function won(n: number): string {
  return `₩${Math.abs(n).toLocaleString('ko-KR')}`;
}

// 부호 포함 원화 (수입 +, 지출/저축이동 -)
export function signedWon(type: TransactionType, n: number): string {
  const sign = type === 'income' ? '+' : '-';
  return `${sign}${won(n)}`;
}

// YYYY-MM-DD → YYYY.MM.DD
export function dotDate(d: string): string {
  return d.replaceAll('-', '.');
}

// 만기까지 남은 일수 (없으면 null)
export function daysUntil(date: string | null): number | null {
  if (!date) return null;
  const diff = new Date(`${date}T00:00:00`).getTime() - Date.now();
  return Math.ceil(diff / (24 * 60 * 60 * 1000));
}

// 현재 월 YYYY-MM
export function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
