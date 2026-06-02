/**
 * 알림 공통 타입 · 톤맵 · 탭 정의 · 상대시각 포맷.
 * 백엔드 응답 DTO(GET /notifications)와 1:1 대응한다. 아이콘은 JSX 라 page.tsx 에서 해석.
 */

export type NotiGroup = 'ledger' | 'system';
export type NotiTone = 'warning' | 'success' | 'info';

export interface Noti {
  id: number;
  group: NotiGroup;
  tone: NotiTone;
  title: string;
  desc: string;
  source: string;
  read: boolean;
  occurredAt: string; // ISO
}

// tone → notif-type-icon CSS 클래스 (info 는 muted 스타일 재사용)
export const TONE_CLASS: Record<NotiTone, string> = {
  warning: 'warning',
  success: 'success',
  info: 'muted',
};

// 필터 탭 (kind 로 필터링)
export const NOTI_TABS: { label: string; kind: 'all' | 'unread' | NotiGroup }[] = [
  { label: '전체', kind: 'all' },
  { label: '읽지 않음', kind: 'unread' },
  { label: '가계부', kind: 'ledger' },
  { label: '시스템', kind: 'system' },
];

// ISO 시각 → 한국어 상대시각 (방금/N분/N시간/N일/N주일 전)
export function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return '방금 전';
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}일 전`;
  const wk = Math.floor(day / 7);
  return `${wk}주일 전`;
}
