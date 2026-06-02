'use client';

/**
 * 공통 상단 헤더 바.
 * 좌측: 햄버거(모바일 사이드바 토글) + 기간 라벨, 중앙: 통합 검색, 우측: 다크토글/알림.
 */
import { useState, useEffect } from 'react';
import GlobalSearch from './GlobalSearch';
import { IconMenu, IconBell } from './icons';

interface TopBarProps {
  /** 좌측 보조 라벨 (예: '2025년 5월') */
  label?: string;
  /** 햄버거 클릭 (모바일 사이드바 토글) */
  onToggleSidebar?: () => void;
}

export default function TopBar({ label, onToggleSidebar }: TopBarProps) {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('theme');
    if (saved === 'dark') {
      setDark(true);
      document.documentElement.setAttribute('data-theme', 'dark');
    }
  }, []);

  const toggleDark = () => {
    const next = !dark;
    setDark(next);
    if (next) {
      document.documentElement.setAttribute('data-theme', 'dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
      localStorage.setItem('theme', 'light');
    }
  };

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
        <button type="button" className="dark-toggle" onClick={toggleDark} aria-label={dark ? '라이트 모드로 전환' : '다크 모드로 전환'}>
          {dark ? '☀️' : '🌙'}
        </button>
        {/* TODO: API 연동 — 미읽음 알림 수 GET /api/v1/notifications/unread-count */}
        <a href="#" className="bell-btn" aria-label="알림">
          <IconBell width={18} height={18} />
          <span className="bell-count">3</span>
        </a>
      </div>
    </div>
  );
}
