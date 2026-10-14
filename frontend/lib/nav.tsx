/**
 * 메뉴 정의 — 사이드바와 휴대폰 '전체 메뉴' 시트가 같이 쓴다. 순서는 고정(사용자 편집 없음).
 * 묶음: 대시보드 / 돈 / 보관함 / 일정 / 관리 (시안 §2.3). 사이드바에서는 묶음이 1차 메뉴(눌러서 펼침), 항목이 2차 메뉴다.
 */
import type { ReactNode } from 'react';
import {
  IconGrid, IconWon, IconRepeat, IconPie, IconKey, IconFolder, IconCalendar,
  IconShield, IconBell, IconLogs, IconTag, IconSettings, IconHome, IconMenu,
  IconCoins, IconArchive, IconClock, IconSliders,
} from '@/components/icons';

export interface NavItem {
  label: string;
  href: string;
  icon: ReactNode;
  /** 개수 배지를 붙일 항목 (알림) */
  badge?: 'unread';
}

export interface NavSection {
  /** 묶음 이름 — 대시보드 줄은 이름 없음(1차 메뉴 없이 바로 링크) */
  label: string;
  /** 사이드바 1차 메뉴 아이콘 */
  icon?: ReactNode;
  items: NavItem[];
}

export const NAV: NavSection[] = [
  { label: '', items: [{ label: '대시보드', href: '/dashboard', icon: <IconGrid /> }] },
  {
    label: '돈',
    icon: <IconCoins />,
    items: [
      { label: '가계부', href: '/transactions', icon: <IconWon /> },
      { label: '구독 관리', href: '/subscriptions', icon: <IconRepeat /> },
      { label: '자산 종합', href: '/networth', icon: <IconPie /> },
    ],
  },
  {
    label: '보관함',
    icon: <IconArchive />,
    items: [
      { label: '계정 보관함', href: '/credentials', icon: <IconKey /> },
      { label: '파일 보관함', href: '/files', icon: <IconFolder /> },
    ],
  },
  { label: '일정', icon: <IconClock />, items: [{ label: '캘린더', href: '/calendar', icon: <IconCalendar /> }] },
  {
    label: '관리',
    icon: <IconSliders />,
    items: [
      { label: '보안', href: '/security', icon: <IconShield /> },
      { label: '알림', href: '/notifications', icon: <IconBell />, badge: 'unread' },
      { label: '시스템 로그', href: '/logs', icon: <IconLogs /> },
      { label: '코드 관리', href: '/codes', icon: <IconTag /> },
      { label: '설정', href: '/settings', icon: <IconSettings /> },
    ],
  },
];

// 휴대폰 아래 메뉴 5칸 — 마지막 '더보기'는 전체 메뉴 시트를 연다
export const BOTTOM_NAV: (NavItem | { label: string; href: null; icon: ReactNode })[] = [
  { label: '홈', href: '/dashboard', icon: <IconHome /> },
  { label: '가계부', href: '/transactions', icon: <IconWon /> },
  { label: '계정', href: '/credentials', icon: <IconKey /> },
  { label: '일정', href: '/calendar', icon: <IconCalendar /> },
  { label: '더보기', href: null, icon: <IconMenu /> },
];
