'use client';

/**
 * 공통 좌측 네비게이션 사이드바.
 * 1차 메뉴 + 접이식 2차 메뉴 그룹, 하단 사용자 정보 + 로그아웃 버튼으로 구성된다.
 * 모바일에서는 오버레이와 함께 슬라이드 인/아웃 (open prop 으로 제어).
 */
import { useState, type ReactNode } from 'react';
import {
  IconLogo, IconGrid, IconChart, IconWon, IconRepeat, IconPie, IconFolder,
  IconLock, IconCode, IconIdCard, IconDoc, IconCheckSquare, IconCalendar,
  IconCube, IconChat, IconSettings, IconShield, IconBell, IconTrash,
  IconCaret, IconLogout,
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

// 대시보드(단일) + 그룹 메뉴 정의.
// TODO: 각 href 는 실제 라우트 구현 시 연결. 현재는 대시보드 외 미구현이라 '#' placeholder.
const TOP_LINK: NavLeaf = { label: '대시보드', href: '/dashboard', icon: <IconGrid /> };

const NAV_GROUPS: NavGroup[] = [
  {
    label: '금융',
    icon: <IconChart className="nav-ic" />,
    children: [
      { label: '가계부', href: '/transactions', icon: <IconWon /> },
      { label: '구독 관리', href: '/subscriptions', icon: <IconRepeat /> },
      { label: '자산 종합', href: '/networth', icon: <IconPie /> },
    ],
  },
  {
    label: '보관함',
    icon: <IconFolder className="nav-ic" />,
    children: [
      { label: '계정 보관함', href: '/credentials', icon: <IconLock /> },
      { label: 'ENV 보관함', href: '/envs', icon: <IconCode /> },
      { label: '파일 보관함', href: '/files', icon: <IconFolder /> },
      { label: '신원 지갑', href: '/id-wallet', icon: <IconIdCard /> },
    ],
  },
  {
    label: '도구',
    icon: <IconDoc className="nav-ic" />,
    children: [
      { label: '메모', href: '#', icon: <IconDoc /> },
      { label: '할일/목표', href: '#', icon: <IconCheckSquare /> },
      { label: '캘린더', href: '#', icon: <IconCalendar /> },
    ],
  },
  {
    label: '인사이트',
    icon: <IconCube className="nav-ic" />,
    children: [
      { label: 'AI 리포트', href: '#', icon: <IconCube /> },
      { label: 'AI 챗', href: '#', icon: <IconChat /> },
    ],
  },
  {
    label: '시스템',
    icon: <IconSettings className="nav-ic" />,
    children: [
      { label: '보안 센터', href: '#', icon: <IconShield /> },
      { label: '알림', href: '#', icon: <IconBell />, badge: 3 },
      { label: '휴지통', href: '#', icon: <IconTrash /> },
      { label: '설정', href: '#', icon: <IconSettings /> },
    ],
  },
];

interface SidebarProps {
  /** 현재 활성 경로 (active 표시용) */
  activePath?: string;
  /** 모바일 열림 상태 */
  open?: boolean;
  /** 로그아웃 클릭 핸들러 */
  onLogout?: () => void;
}

export default function Sidebar({ activePath = '/dashboard', open = false, onLogout }: SidebarProps) {
  return (
    <aside className={`sidebar${open ? ' open' : ''}`}>
      {/* 로고 */}
      <div className="sidebar-logo">
        <IconLogo width={22} height={22} />
        Doc<span className="accent">Nexus</span>
      </div>

      {/* 네비게이션 */}
      <nav className="sidebar-nav">
        <a href={TOP_LINK.href} className={`nav-link${activePath === TOP_LINK.href ? ' active' : ''}`}>
          {TOP_LINK.icon}
          {TOP_LINK.label}
        </a>
        {NAV_GROUPS.map((group) => (
          <NavGroupItem key={group.label} group={group} activePath={activePath} />
        ))}
      </nav>

      {/* 하단 사용자 정보 + 로그아웃 */}
      {/* TODO: API 연동 — GET /api/v1/users/me 로 이름·이메일·아바타 대체 */}
      <div className="sidebar-footer">
        <div className="user-row">
          <div className="avatar">K</div>
          <div className="user-info">
            <div className="user-name">김관리자</div>
            <div className="user-email">user@gmail.com</div>
          </div>
          <button type="button" className="logout-btn" onClick={onLogout} aria-label="로그아웃" title="로그아웃">
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
    <div className={`nav-group${openGroup ? ' open' : ''}`}>
      <button
        type="button"
        className={`nav-parent${hasActive ? ' has-active' : ''}`}
        onClick={() => setOpenGroup((v) => !v)}
      >
        {group.icon}
        <span>{group.label}</span>
        <IconCaret className="nav-caret" />
      </button>
      <div className="nav-sub">
        {group.children.map((leaf) => (
          <a
            key={leaf.label}
            href={leaf.href}
            className={`nav-link${leaf.href === activePath ? ' active' : ''}`}
          >
            {leaf.icon}
            {leaf.label}
            {leaf.badge != null && <span className="nav-badge">{leaf.badge}</span>}
          </a>
        ))}
      </div>
    </div>
  );
}
