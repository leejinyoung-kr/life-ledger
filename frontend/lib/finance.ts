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
export type TransferTarget = 'saving' | 'investment';

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
  recurringScheduleId: number | null; // 자동이체 설정으로 생성된 회차면 그 설정 id
  targetType: TransferTarget | null; // 자산이동 누적 대상 종류 (transfer 전용)
  targetId: number | null; // 자산이동 누적 대상 id
}

// 거래 즐겨찾기 — 수입/지출만, 날짜 없이 저장해 두고 오늘 날짜로 불러온다
export interface TransactionFavorite {
  id: number;
  type: 'income' | 'expense';
  title: string;
  category: string; // 코드
  amount: number;
  payMethod: string;
  memo: string | null;
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
  currentValueUsd: number | null; // 해외종목 달러 평가금액 — 국내종목은 null
  profit: number;
  profitRate: number;
  purchaseDate: string | null;
  memo: string | null;
  updatedAt: string; // 평가금액 최근 수정 시각(ISO) — 시세 API 연동 전까지 수동 입력 신뢰도 표시용
}

// 자동이체 설정(자동 생성 규칙) — kind에 따라 거래/투자 전용 필드가 갈린다. GET /recurring-schedules 응답 DTO
export interface RecurringSchedule {
  id: number;
  kind: 'transaction' | 'investment';
  rule: RecurringRule;
  startDate: string; // YYYY-MM-DD
  lastPeriod: string | null;
  active: boolean;
  nextRunDate: string | null; // 다음 실행(생성) 예정일 — 목록 표시용

  // kind=transaction 전용
  txType: TransactionType | null;
  title: string | null;
  category: string | null;
  amount: number | null;
  payMethod: string | null;
  memo: string | null;
  targetType: TransferTarget | null;
  targetId: number | null;

  // kind=investment 전용
  investmentId: number | null;
  investmentName: string | null;
  investmentSymbol: string | null;
  buyAmount: number | null;
  buyQuantity: number | null;
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
  startDate: string | null; // 가입일 — ISA 등 만기 기산일
  maturityDate: string | null; // 만기일(예: ISA 3년) — 미입력 시 만기 알림 대상 아님
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

export const SAVING_TYPE_LABEL: Record<SavingType, string> = {
  savings: '적금',
  deposit: '예금',
  subscription: '청약',
  etc: '기타',
};

export const INVEST_TYPE_LABEL: Record<InvestmentType, string> = {
  domestic_stock: '국내주식',
  foreign_stock: '해외주식',
  foreign_etf: '해외ETF',
  domestic_etf: '국내ETF',
  crypto: '가상자산',
  etc: '기타',
};

// ── 포맷 유틸 ────────────────────────────────────────────────────
// 원화 표시 (₩1,234,000 · 음수는 -₩1,234,000) — 부호를 따로 붙이는 곳은 Math.abs 로 넘긴다
export function won(n: number): string {
  return `${n < 0 ? '-' : ''}₩${Math.abs(n).toLocaleString('ko-KR')}`;
}

// 달러 표시 ($1,234.56)
export function usd(n: number): string {
  return `$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// 부호 포함 원화 (수입 +, 지출/저축이동 -)
export function signedWon(type: TransactionType, n: number): string {
  const sign = type === 'income' ? '+' : '-';
  return `${sign}${won(Math.abs(n))}`;
}

// YYYY-MM-DD → YYYY.MM.DD
export function dotDate(d: string): string {
  return d.replaceAll('-', '.');
}

// 만기 예상금액 — 예금: 단리, 적금: 현재 잔액 + 남은 회차 월납입 단리 합산. 청약·기타·만기일 없음은 null
export function calcMaturityAmount(saving: Saving): number | null {
  if (!saving.maturityDate) return null;
  if (saving.type === 'subscription' || saving.type === 'etc') return null;
  const start = new Date(`${saving.startDate}T00:00:00`);
  const maturity = new Date(`${saving.maturityDate}T00:00:00`);
  const rate = saving.interestRate / 100;
  if (saving.type === 'deposit') {
    const days = (maturity.getTime() - start.getTime()) / 86400000;
    if (days <= 0) return null;
    return Math.round(saving.balance * (1 + rate * days / 365));
  }
  // savings: 오늘 기준 현재 잔액에 남은 회차분(월납입 단리)만 더함 — 이미 납입한 회차는 balance에 반영되어 있다고 가정
  const today = new Date(new Date().toDateString());
  if (maturity <= today) return Math.round(saving.balance);
  const remaining = (maturity.getFullYear() - today.getFullYear()) * 12 + (maturity.getMonth() - today.getMonth());
  if (remaining <= 0 || saving.monthlyAmount <= 0) return Math.round(saving.balance);
  const futurePrincipal = saving.monthlyAmount * remaining;
  const futureInterest = saving.monthlyAmount * (remaining * (remaining + 1) / 2) * (rate / 12);
  return Math.round(saving.balance + futurePrincipal + futureInterest);
}

// 만기까지 남은 일수 (없으면 null)
export function daysUntil(date: string | null): number | null {
  if (!date) return null;
  const diff = new Date(`${date}T00:00:00`).getTime() - Date.now();
  return Math.ceil(diff / (24 * 60 * 60 * 1000));
}

// 로컬(KST) 날짜 YYYY-MM-DD — toISOString 은 UTC 라 오전 9시 전에는 하루 전 날짜가 된다
export function localDate(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// 현재 월 YYYY-MM
export function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
