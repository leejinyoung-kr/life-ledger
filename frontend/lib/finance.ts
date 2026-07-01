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
  parentCode: string | null; // 소분류면 대분류 code, 대분류·단일계층이면 null
  sortOrder: number;
  isActive: boolean;
}

export type TransactionType = 'income' | 'expense' | 'transfer';
export type RecurringCycle = 'daily' | 'monthly' | 'weekly' | 'yearly';
export type WeekendAdjust = 'none' | 'before' | 'after';
// 자산이동(transfer) 누적 대상 — 거래 저장 시 지정하면 대상 잔액에 자동 반영됨
export type TransferTarget = 'saving' | 'investment' | 'asset';
// 대상 잔액 변화 방향 — asset 대상 전용(예: 할부 구매=increase, 상환=decrease)
export type TransferDirection = 'increase' | 'decrease';

export interface RecurringRule {
  cycle: RecurringCycle;
  /** 매월·매년: 1-31일(그 달의 며칠), 매주: 0(일)~6(토), 매일: 미사용 */
  day: number;
  /** 매년에서만 사용(1-12). 미지정 시 시작일의 월을 그대로 따름 */
  month?: number;
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
  recurringParentId: number | null; // 반복 원본에서 자동 생성된 회차면 부모 id
  targetType: TransferTarget | null; // 자산이동 누적 대상 종류 (transfer 전용)
  targetId: number | null; // 자산이동 누적 대상 id
  targetDirection: TransferDirection | null; // 대상 잔액 변화 방향 (asset 대상 전용)
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
  accountId: number; // 소속 투자 계좌(InvestmentAccount.id) — 예수금은 계좌 단위로 공유
  name: string;
  type: InvestmentType;
  symbol: string | null; // 시세조회용 종목코드(국내) 또는 티커(해외)
  quantity: number | null; // 보유수량 — 시세조회 시 단가와 곱해 평가금액 계산
  principal: number;
  principalUsd: number | null; // 해외종목 달러 원금 — 국내종목은 null
  currentValue: number;
  profit: number;
  profitRate: number;
  purchaseDate: string | null;
  memo: string | null;
  recurringBuyEnabled: boolean; // 반복매수(주식모으기) 사용 여부
  recurringBuyRule: RecurringRule | null; // 반복 규칙 — 거래의 recurringRule과 동일 구조
  recurringBuyAmount: number | null; // 회차당 매수금액(국내: 원, 해외: 달러) — recurringBuyQuantity와 동시 사용 불가
  recurringBuyQuantity: number | null; // 회차당 매수수량(주) — recurringBuyAmount와 동시 사용 불가
  updatedAt: string; // 평가금액 최근 수정 시각(ISO) — 시세 API 연동 전까지 수동 입력 신뢰도 표시용
}

export interface InvestmentSummary {
  totalValue: number;
  totalPrincipal: number;
  totalProfit: number;
  profitRate: number;
}

// 투자 계좌 — 예수금을 보유하고 여러 종목(Investment)이 공유(예: ISA)
export interface InvestmentAccount {
  id: number;
  name: string;
  cashBalance: number;
  cashBalanceUsd: number; // 달러 예수금 — 환전(원화↔달러)으로만 증감
  accountNumber: string | null; // 마스킹된 형태로만 응답(예: 110••••7890)
  memo: string | null;
  holdingsCount: number;
  totalPrincipal: number;
  totalCurrentValue: number;
}

// ── 라벨맵 (코드 ↔ 화면 표시) ────────────────────────────────────
export const TX_TYPE_LABEL: Record<TransactionType, string> = {
  income: '수입',
  expense: '지출',
  transfer: '자산이동',
};

export const TRANSFER_TARGET_LABEL: Record<TransferTarget, string> = {
  saving: '예적금',
  investment: '투자',
  asset: '부동산·부채',
};

// asset 대상일 때만 의미 — 할부 구매 등 증가/상환 등 감소
export const TRANSFER_DIRECTION_LABEL: Record<TransferDirection, string> = {
  increase: '증가 (예: 할부 구매)',
  decrease: '감소 (예: 상환)',
};

export const CYCLE_LABEL: Record<RecurringCycle, string> = {
  daily: '매일',
  monthly: '매월',
  weekly: '매주',
  yearly: '매년',
};

export const WEEKEND_ADJUST_LABEL: Record<WeekendAdjust, string> = {
  none: '조정 안 함',
  before: '전 금요일',
  after: '다음 월요일',
};

export const WEEKDAY_LABEL = ['일', '월', '화', '수', '목', '금', '토'];

// 반복 규칙 요약 — "매일(평일만)" / "매월 5일" / "매주 화요일" / "매년 3월 15일"
export function recurringRuleSummary(rule: RecurringRule): string {
  if (rule.cycle === 'daily') return '매일 (평일만)';
  if (rule.cycle === 'weekly') return `매주 ${WEEKDAY_LABEL[rule.day]}요일`;
  if (rule.cycle === 'yearly' && rule.month) return `매년 ${rule.month}월 ${rule.day}일`;
  return `${CYCLE_LABEL[rule.cycle]} ${rule.day}일`;
}

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

// 달러 표시 ($1,234.56)
export function usd(n: number): string {
  return `$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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
