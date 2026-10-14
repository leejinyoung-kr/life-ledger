/**
 * 알림 공통 타입 · 톤맵 · 탭 정의 · 상대시각 포맷.
 * 백엔드 응답 DTO(GET /notifications)와 1:1 대응한다.
 */
import type { ComponentType, SVGProps } from 'react';
import { IconBank, IconBell, IconFolder, IconKey, IconRepeat, IconShield, IconTrendUp } from '@/components/icons';

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

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

// 필터 탭 (kind 로 필터링)
export const NOTI_TABS: { label: string; kind: 'all' | NotiGroup }[] = [
  { label: '전체', kind: 'all' },
  { label: '가계부', kind: 'ledger' },
  { label: '시스템', kind: 'system' },
];

// 출처(source) → 종류 아이콘. 백엔드가 만드는 출처 6개 외에는 종 아이콘
export const SOURCE_ICON: Record<string, IconComponent> = {
  '구독': IconRepeat,
  '예적금': IconBank,
  '투자': IconTrendUp,
  '보안': IconShield,
  '계정 보관함': IconKey,
  '파일 보관함': IconFolder,
};
export const FALLBACK_SOURCE_ICON: IconComponent = IconBell;

// 출처(source) → 이동할 화면. 알림에 링크 필드가 없어 프론트에서 고정 매핑 — 없는 출처는 이동 버튼을 숨긴다. 예적금 · 투자는 가계부의 그 탭으로 연다
export const SOURCE_LINK: Record<string, { href: string; label: string }> = {
  '구독': { href: '/subscriptions', label: '구독 관리' },
  '예적금': { href: '/transactions?tab=savings', label: '예적금' },
  '투자': { href: '/transactions?tab=invest', label: '투자' },
  '보안': { href: '/security', label: '보안' },
  '계정 보관함': { href: '/credentials', label: '계정 보관함' },
  '파일 보관함': { href: '/files', label: '파일 보관함' },
};

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
