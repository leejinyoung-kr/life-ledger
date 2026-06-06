/**
 * 캘린더 공통 타입 · 유형 라벨/옵션 · 범례.
 * 백엔드 응답 DTO(/calendar)와 1:1 대응한다.
 */

export type EvType = 'pay' | 'due' | 'exp' | 'task';
export type VirtSource = 'subscription' | 'saving' | 'identity' | 'task';

export interface CalEvent {
  id: number;
  date: string; // YYYY-MM-DD
  type: EvType;
  title: string;
  memo: string | null;
  virtual: boolean;       // true = 다른 테이블에서 연동된 가상 이벤트
  sourceType?: VirtSource; // 연동 원본 테이블
}

// sourceType → 한글 라벨 + 원본 페이지 경로
export const VIRT_SOURCE_META: Record<VirtSource, { label: string; path: string }> = {
  subscription: { label: '구독',     path: '/subscriptions' },
  saving:       { label: '예적금',   path: '/transactions' },
  identity:     { label: '신원지갑', path: '/id-wallet' },
  task:         { label: '할일',     path: '/tasks' },
};

export interface UpcomingEvent extends CalEvent {
  daysUntil: number;
}

export const EV_TYPE_LABEL: Record<EvType, string> = {
  pay: '구독 결제',
  due: '입금 / 만기',
  exp: '서류 만료',
  task: '할일',
};

// 입력 폼 유형 옵션 (코드 ↔ 라벨)
export const EV_TYPE_OPTIONS: { value: EvType; label: string }[] = [
  { value: 'pay', label: '구독 결제' },
  { value: 'due', label: '입금 / 만기' },
  { value: 'exp', label: '서류 만료' },
  { value: 'task', label: '할일' },
];

// 범례 (그리드 색 점)
export const EV_LEGEND: { type: EvType; label: string }[] = EV_TYPE_OPTIONS.map((o) => ({
  type: o.value,
  label: o.label,
}));

// 남은 일수 → D-day 라벨 (오늘/내일/D-n)
export function ddLabel(days: number): string {
  if (days <= 0) return '오늘';
  if (days === 1) return '내일';
  return `D-${days}`;
}
