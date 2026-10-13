'use client';

/**
 * 공통 좌측 네비게이션 사이드바 (Tailwind).
 * 1차 메뉴 + 접이식 2차 메뉴 그룹, 하단 사용자 정보 + 로그아웃 버튼으로 구성된다.
 * 모바일에서는 오버레이와 함께 슬라이드 인/아웃 (open prop 으로 제어).
 */
import { useState, type ReactNode } from 'react';
import { useApiQuery } from '@/lib/query';
import {
  IconLogo, IconGrid, IconChart, IconWon, IconRepeat, IconPie, IconFolder,
  IconLock, IconDoc, IconCalendar,
  IconSettings, IconShield, IconBell,
  IconCaret, IconLogout, IconBars, IconClock,
} from './icons';

interface NavLeaf {
  label: string;
  href: string;
  icon: ReactNode;
}

interface NavGroup {
  key: string;
  label: string;
  icon: ReactNode;
  children: NavLeaf[];
}

const GROUP_IC = 'w-[17px] h-[17px] shrink-0';

// 대시보드(단일) + 그룹 메뉴 정의. 표시 순서는 고정 — 대시보드, 그다음 NAV_GROUPS 배열 순서.
const TOP_LINK: NavLeaf = { label: '대시보드', href: '/dashboard', icon: <IconGrid /> };

const NAV_GROUPS: NavGroup[] = [
  {
    key: 'finance',
    label: '금융',
    icon: <IconChart className={GROUP_IC} />,
    children: [
      { label: '가계부', href: '/transactions', icon: <IconWon /> },
      { label: '구독 관리', href: '/subscriptions', icon: <IconRepeat /> },
      { label: '자산 종합', href: '/networth', icon: <IconPie /> },
    ],
  },
  {
    key: 'vault',
    label: '보관함',
    icon: <IconFolder className={GROUP_IC} />,
    children: [
      { label: '계정 보관함', href: '/credentials', icon: <IconLock /> },
      { label: '파일 보관함', href: '/files', icon: <IconFolder /> },
    ],
  },
  {
    key: 'tools',
    label: '도구',
    icon: <IconDoc className={GROUP_IC} />,
    children: [
      { label: '캘린더', href: '/calendar', icon: <IconCalendar /> },
    ],
  },
  {
    key: 'system',
    label: '시스템',
    icon: <IconSettings className={GROUP_IC} />,
    children: [
      { label: '보안', href: '/security', icon: <IconShield /> },
      { label: '알림', href: '/notifications', icon: <IconBell /> },
      { label: '시스템 로그', href: '/logs', icon: <IconClock /> },
      { label: '코드 관리', href: '/codes', icon: <IconBars /> },
      { label: '설정', href: '/settings', icon: <IconSettings /> },
    ],
  },
];

// nav-link 공통 클래스 (leaf 아이콘 17px 자동 사이즈)
const NAV_LINK = 'flex items-center gap-2.5 px-2.5 py-2 rounded-ui text-[0.875rem] font-medium transition-colors [&_svg]:w-[17px] [&_svg]:h-[17px] [&_svg]:shrink-0';

interface SidebarProps {
  /** 현재 활성 경로 (active 표시용) */
  activePath?: string;
  /** 모바일 열림 상태 */
  open?: boolean;
  /** 로그아웃 클릭 핸들러 */
  onLogout?: () => void;
}

interface MeUser { name: string; email: string }

export default function Sidebar({ activePath = '/dashboard', open = false, onLogout }: SidebarProps) {
  // 로그인 사용자 — React Query 캐시 구독
  const me = useApiQuery<MeUser>(['auth', 'me'], '/auth/me').data ?? null;

  const name = me?.name || '사용자';
  const email = me?.email || '';

  return (
    <aside className={`w-[var(--sidebar-w)] h-screen bg-background border-r border-border flex flex-col fixed top-0 left-0 z-[100] transition-transform max-md:-translate-x-full ${open ? 'max-md:translate-x-0 max-md:shadow-overlay' : ''}`}>
      {/* 로고 */}
      <div className="h-[60px] flex items-center px-5 gap-2.5 border-b border-border [font-family:var(--font-display)] font-extrabold text-[1.1rem] tracking-[-0.03em] text-primary">
        <IconLogo width={22} height={22} />
        <span>Life<span className="text-accent">Ledger</span></span>
      </div>

      {/* 네비게이션 — 대시보드(링크) + 접이식 그룹을 고정 순서로 렌더 */}
      <nav className="flex-1 p-3 flex flex-col gap-0.5 overflow-y-auto">
        <a href={TOP_LINK.href} className={`${NAV_LINK} ${activePath === TOP_LINK.href ? 'bg-accent-dim text-accent font-semibold' : 'text-secondary hover:bg-surface hover:text-primary'}`}>
          {TOP_LINK.icon}
          {TOP_LINK.label}
        </a>
        {NAV_GROUPS.map((group) => (
          <NavGroupItem key={group.key} group={group} activePath={activePath} />
        ))}
      </nav>

      {/* 하단 사용자 정보 + 로그아웃 — 모바일에선 BottomNav(z-[100], 동일 영역)에 가려지지 않도록 위로 띄움 */}
      <div className="p-3 border-t border-border max-md:mb-[calc(60px+env(safe-area-inset-bottom))]">
        <button
          type="button"
          className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-ui cursor-pointer transition-colors hover:bg-danger-dim text-left"
          onClick={onLogout}
          aria-label="로그아웃"
          title="로그아웃"
        >
          <div className="w-8 h-8 rounded-full bg-accent-dim border-[1.5px] border-accent flex items-center justify-center [font-family:var(--font-display)] text-[0.75rem] font-bold text-accent shrink-0">{name.charAt(0)}</div>
          <div className="overflow-hidden flex-1">
            <div className="text-[0.82rem] font-semibold text-primary">{name}</div>
            <div className="text-[0.72rem] text-muted whitespace-nowrap overflow-hidden text-ellipsis">{email}</div>
          </div>
          <span className="w-[30px] h-[30px] flex items-center justify-center rounded-ui text-muted shrink-0 [&_svg]:w-4 [&_svg]:h-4">
            <IconLogout />
          </span>
        </button>
      </div>
    </aside>
  );
}

// 접이식 2차 메뉴 그룹 — 클릭 시 펼침/접힘 토글.
// 현재 경로가 그룹 내 자식과 일치하면 처음부터 펼쳐지고 부모를 강조한다.
function NavGroupItem({ group, activePath }: { group: NavGroup; activePath: string }) {
  const hasActive = group.children.some((leaf) => leaf.href === activePath);
  const [openGroup, setOpenGroup] = useState(hasActive);
  return (
    <div className="flex flex-col">
      <button
        type="button"
        className={`flex items-center gap-2.5 px-2.5 py-2 rounded-ui text-[0.875rem] font-medium w-full text-left transition-colors ${hasActive ? 'text-accent font-semibold' : 'text-secondary hover:bg-surface hover:text-primary'}`}
        onClick={() => setOpenGroup((v) => !v)}
      >
        {group.icon}
        <span>{group.label}</span>
        <IconCaret className={`ml-auto w-3.5 h-3.5 shrink-0 transition-transform ${openGroup ? 'rotate-180' : ''}`} />
      </button>
      <div className={`${openGroup ? 'flex' : 'hidden'} flex-col gap-0.5 mt-0.5`}>
        {group.children.map((leaf) => (
          <a
            key={leaf.label}
            href={leaf.href}
            className={`${NAV_LINK} pl-[38px] text-[0.84rem] ${leaf.href === activePath ? 'bg-accent-dim text-accent font-semibold' : 'text-secondary hover:bg-surface hover:text-primary'}`}
          >
            {leaf.icon}
            {leaf.label}
          </a>
        ))}
      </div>
    </div>
  );
}
