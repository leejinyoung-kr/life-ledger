'use client';

/**
 * 공통 좌측 네비게이션 사이드바 (Tailwind).
 * 1차 메뉴 + 접이식 2차 메뉴 그룹, 하단 사용자 정보 + 로그아웃 버튼으로 구성된다.
 * 모바일에서는 오버레이와 함께 슬라이드 인/아웃 (open prop 으로 제어).
 */
import { useEffect, useState, type ReactNode } from 'react';
import { api } from '@/lib/api';
import {
  IconLogo, IconGrid, IconChart, IconWon, IconRepeat, IconPie, IconFolder,
  IconLock, IconCode, IconIdCard, IconDoc, IconCheckSquare, IconCalendar,
  IconCube, IconChat, IconSettings, IconShield, IconBell, IconTrash,
  IconCaret, IconLogout, IconBars,
} from './icons';

interface NavLeaf {
  label: string;
  href: string;
  icon: ReactNode;
  badge?: number;
}

interface NavGroup {
  label: string;
  icon: ReactNode;
  children: NavLeaf[];
}

const GROUP_IC = 'w-[17px] h-[17px] shrink-0';

// 대시보드(단일) + 그룹 메뉴 정의.
const TOP_LINK: NavLeaf = { label: '대시보드', href: '/dashboard', icon: <IconGrid /> };

const NAV_GROUPS: NavGroup[] = [
  {
    label: '금융',
    icon: <IconChart className={GROUP_IC} />,
    children: [
      { label: '가계부', href: '/transactions', icon: <IconWon /> },
      { label: '구독 관리', href: '/subscriptions', icon: <IconRepeat /> },
      { label: '자산 종합', href: '/networth', icon: <IconPie /> },
    ],
  },
  {
    label: '보관함',
    icon: <IconFolder className={GROUP_IC} />,
    children: [
      { label: '계정 보관함', href: '/credentials', icon: <IconLock /> },
      { label: 'ENV 보관함', href: '/envs', icon: <IconCode /> },
      { label: '파일 보관함', href: '/files', icon: <IconFolder /> },
      { label: '신원 지갑', href: '/id-wallet', icon: <IconIdCard /> },
    ],
  },
  {
    label: '도구',
    icon: <IconDoc className={GROUP_IC} />,
    children: [
      { label: '메모', href: '/notes', icon: <IconDoc /> },
      { label: '할일/목표', href: '/tasks', icon: <IconCheckSquare /> },
      { label: '캘린더', href: '/calendar', icon: <IconCalendar /> },
    ],
  },
  {
    label: '인사이트',
    icon: <IconCube className={GROUP_IC} />,
    children: [
      { label: 'AI 리포트', href: '/ai-report', icon: <IconCube /> },
      { label: 'AI 챗', href: '/assistant', icon: <IconChat /> },
    ],
  },
  {
    label: '시스템',
    icon: <IconSettings className={GROUP_IC} />,
    children: [
      { label: '보안 센터', href: '/security', icon: <IconShield /> },
      { label: '알림', href: '/notifications', icon: <IconBell />, badge: 3 },
      { label: '코드 관리', href: '/codes', icon: <IconBars /> },
      { label: '휴지통', href: '/trash', icon: <IconTrash /> },
      { label: '설정', href: '/settings', icon: <IconSettings /> },
    ],
  },
];

// nav-link 공통 클래스 (leaf 아이콘 17px 자동 사이즈)
const NAV_LINK = 'flex items-center gap-2.5 px-2.5 py-2 rounded-[var(--radius)] text-[0.875rem] font-medium transition-colors [&_svg]:w-[17px] [&_svg]:h-[17px] [&_svg]:shrink-0';

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
  const [me, setMe] = useState<MeUser | null>(null);

  // 로그인 사용자 정보 조회 (이름·이메일·아바타 이니셜)
  useEffect(() => {
    api.get<MeUser>('/auth/me').then(setMe).catch(() => {});
  }, []);

  const name = me?.name || '사용자';
  const email = me?.email || '';

  return (
    <aside className={`w-[var(--sidebar-w)] min-h-screen bg-background border-r border-border flex flex-col fixed top-0 left-0 z-[100] transition-transform max-md:-translate-x-full ${open ? 'max-md:translate-x-0 max-md:shadow-[var(--shadow-lg)]' : ''}`}>
      {/* 로고 */}
      <div className="h-[60px] flex items-center px-5 gap-2.5 border-b border-border [font-family:var(--font-display)] font-extrabold text-[1.1rem] tracking-[-0.03em] text-primary">
        <IconLogo width={22} height={22} />
        Doc<span className="text-accent">Nexus</span>
      </div>

      {/* 네비게이션 */}
      <nav className="flex-1 p-3 flex flex-col gap-0.5 overflow-y-auto">
        <a href={TOP_LINK.href} className={`${NAV_LINK} ${activePath === TOP_LINK.href ? 'bg-accent-dim text-accent font-semibold' : 'text-secondary hover:bg-surface hover:text-primary'}`}>
          {TOP_LINK.icon}
          {TOP_LINK.label}
        </a>
        {NAV_GROUPS.map((group) => (
          <NavGroupItem key={group.label} group={group} activePath={activePath} />
        ))}
      </nav>

      {/* 하단 사용자 정보 + 로그아웃 */}
      <div className="p-3 border-t border-border">
        <div className="flex items-center gap-2.5 px-2.5 py-2 rounded-[var(--radius)] cursor-pointer transition-colors hover:bg-surface">
          <div className="w-8 h-8 rounded-full bg-accent-dim border-[1.5px] border-accent flex items-center justify-center [font-family:var(--font-display)] text-[0.75rem] font-bold text-accent shrink-0">{name.charAt(0)}</div>
          <div className="overflow-hidden flex-1">
            <div className="text-[0.82rem] font-semibold text-primary">{name}</div>
            <div className="text-[0.72rem] text-muted whitespace-nowrap overflow-hidden text-ellipsis">{email}</div>
          </div>
          <button type="button" className="w-[30px] h-[30px] flex items-center justify-center rounded-[var(--radius)] text-muted shrink-0 transition-colors hover:bg-danger-dim hover:text-danger [&_svg]:w-4 [&_svg]:h-4" onClick={onLogout} aria-label="로그아웃" title="로그아웃">
            <IconLogout />
          </button>
        </div>
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
        className={`flex items-center gap-2.5 px-2.5 py-2 rounded-[var(--radius)] text-[0.875rem] font-medium w-full text-left transition-colors ${hasActive ? 'text-accent font-semibold' : 'text-secondary hover:bg-surface hover:text-primary'}`}
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
            {leaf.badge != null && (
              <span className="ml-auto min-w-[18px] h-[18px] bg-danger text-white text-[0.65rem] font-bold rounded-full flex items-center justify-center px-[5px]">{leaf.badge}</span>
            )}
          </a>
        ))}
      </div>
    </div>
  );
}
