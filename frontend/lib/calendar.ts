/**
 * 캘린더 공통 타입 · 유형 라벨/옵션 · 범례.
 * 백엔드 응답 DTO(/calendar)와 1:1 대응한다.
 */

export type EvType = 'pay' | 'due' | 'exp' | 'task' | 'holiday';
export type VirtSource = 'subscription' | 'saving' | 'investmentAccount' | 'holiday';
export type RecurFreq = 'none' | 'weekly' | 'monthly' | 'yearly';

export interface CalEvent {
  id: number;
  date: string; // YYYY-MM-DD — 반복 일정이면 이번 발생일
  type: EvType;
  title: string;
  memo: string | null;
  virtual: boolean;       // true = 다른 테이블에서 연동된 가상 이벤트
  startDate?: string;     // 실제 일정의 원래 날짜 (반복 일정이면 첫 회차) — 수정 폼 기준
  sourceType?: VirtSource; // 연동 원본 테이블
  recurFreq?: RecurFreq;
  recurUntil?: string | null;
  isLunar?: boolean;
  lunarMonth?: number | null;
  lunarDay?: number | null;
  lunarLeap?: boolean;
}

export const RECUR_FREQ_LABEL: Record<RecurFreq, string> = {
  none: '반복 없음',
  weekly: '매주',
  monthly: '매월',
  yearly: '매년',
};

export const RECUR_FREQ_OPTIONS: { value: RecurFreq; label: string }[] = [
  { value: 'none', label: '반복 없음' },
  { value: 'weekly', label: '매주' },
  { value: 'monthly', label: '매월' },
  { value: 'yearly', label: '매년' },
];

// 음력 일정은 "매년" 반복만 의미가 있음(음력 매주/매월 반복은 지원하지 않음)
export const LUNAR_RECUR_FREQ_OPTIONS: { value: RecurFreq; label: string }[] = [
  { value: 'none', label: '반복 없음' },
  { value: 'yearly', label: '매년' },
];

// sourceType → 한글 라벨 + 원본 페이지 경로 (예적금 · 투자는 가계부의 그 탭)
export const VIRT_SOURCE_META: Record<VirtSource, { label: string; path: string }> = {
  subscription:      { label: '구독',     path: '/subscriptions' },
  saving:            { label: '예적금',   path: '/transactions?tab=savings' },
  investmentAccount: { label: '투자',     path: '/transactions?tab=invest' },
  holiday:           { label: '공휴일',   path: '' },
};

export interface UpcomingEvent extends CalEvent {
  daysUntil: number;
}

export const EV_TYPE_LABEL: Record<EvType, string> = {
  pay: '구독 결제',
  due: '입금 · 만기',
  exp: '서류 만료',
  task: '할일',
  holiday: '공휴일',
};

// 입력 폼 유형 옵션 (코드 ↔ 라벨)
export const EV_TYPE_OPTIONS: { value: EvType; label: string }[] = [
  { value: 'pay', label: '구독 결제' },
  { value: 'due', label: '입금 · 만기' },
  { value: 'exp', label: '서류 만료' },
  { value: 'task', label: '할일' },
];

// 범례 (그리드 표식)
export const EV_LEGEND: { type: EvType; label: string }[] = EV_TYPE_OPTIONS.map((o) => ({
  type: o.value,
  label: o.label,
}));

// 남은 일수 → D-day 라벨 (오늘/내일/D-n, 지난 날은 n일 전)
export function ddLabel(days: number): string {
  if (days < 0) return `${-days}일 전`;
  if (days === 0) return '오늘';
  if (days === 1) return '내일';
  return `D-${days}`;
}
