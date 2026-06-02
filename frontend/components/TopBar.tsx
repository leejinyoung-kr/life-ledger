'use client';

/**
 * 공통 상단 헤더 바.
 * 좌측: 햄버거(모바일 사이드바 토글) + 기간 라벨, 중앙: 통합 검색, 우측: 다크토글/알림/주요 액션 버튼.
 */
import type { ReactNode } from 'react';
import GlobalSearch from './GlobalSearch';
import { IconMenu, IconBell, IconPlus } from './icons';

interface TopBarProps {
  /** 좌측 보조 라벨 (예: '2025년 5월') */
  label?: string;
  /** 우측 주요 액션 버튼 라벨 */
  actionLabel?: string;
  /** 햄버거 클릭 (모바일 사이드바 토글) */
  onToggleSidebar?: () => void;
  /** 우측 주요 액션 클릭 */
  onAction?: () => void;
  /** 우측 영역 커스텀 노드 (지정 시 기본 버튼 대체) */
  rightSlot?: ReactNode;
}

export default function TopBar({ label, actionLabel, onToggleSidebar, onAction, rightSlot }: TopBarProps) {
  return (
    <div className="top-bar">
      <div className="top-bar-left">
        <button type="button" className="hamburger" onClick={onToggleSidebar} aria-label="메뉴">
          <IconMenu width={18} height={18} />
        </button>
        {label && <span className="topbar-label">{label}</span>}
      </div>

      {/* 통합 검색 (공통 컴포넌트 재사용) */}
      <GlobalSearch />

      <div className="flex-center gap-2">
        {/* TODO: 다크모드 토글 기능 연동 — 현재는 표시만 */}
        <span className="dark-toggle">🌙</span>
        {/* TODO: API 연동 — 미읽음 알림 수 GET /api/v1/notifications/unread-count */}
        <a href="#" className="bell-btn" aria-label="알림">
          <IconBell width={18} height={18} />
          <span className="bell-count">3</span>
        </a>
        {/* rightSlot 지정 시 기본 액션 버튼 대신 커스텀 영역 렌더 */}
        {rightSlot ?? (actionLabel && (
          <button type="button" className="btn btn-primary" onClick={onAction}>
            <IconPlus width={13} height={13} />
            {actionLabel}
          </button>
        ))}
      </div>
    </div>
  );
}
