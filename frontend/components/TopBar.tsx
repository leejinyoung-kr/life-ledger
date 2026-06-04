'use client';

/**
 * 공통 상단 헤더 바.
 * 좌측: 기간 라벨, 중앙: 통합 검색, 우측: 다크토글/알림.
 * 모바일 메뉴 진입은 하단 내비 '더보기'로 일원화 — 상단 햄버거는 두지 않는다.
 */
import { useState, useEffect } from 'react';
import GlobalSearch from './GlobalSearch';
import { IconBell } from './icons';

interface TopBarProps {
  /** 좌측 보조 라벨 (예: '2025년 5월') */
  label?: string;
}

export default function TopBar({ label }: TopBarProps) {
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
    <div className="h-[60px] border-b border-border flex items-center justify-between px-8 bg-background sticky top-0 z-50 gap-3 max-md:px-4">
      <div className="flex items-center gap-3">
        {label && <span className="text-[0.78rem] text-muted">{label}</span>}
      </div>

      {/* 통합 검색 (공통 컴포넌트 재사용) */}
      <GlobalSearch />

      <div className="flex items-center gap-2">
        <button
          type="button"
          className="text-[1.2rem] w-9 h-9 flex items-center justify-center rounded-[var(--radius)] cursor-pointer transition-[background] select-none hover:bg-surface"
          onClick={toggleDark}
          aria-label={dark ? '라이트 모드로 전환' : '다크 모드로 전환'}
        >
          {dark ? '☀️' : '🌙'}
        </button>
        {/* TODO: API 연동 — 미읽음 알림 수 GET /api/v1/notifications/unread-count */}
        <a href="#" className="relative w-9 h-9 flex items-center justify-center rounded-[var(--radius)] text-secondary transition-colors shrink-0 hover:bg-surface hover:text-primary" aria-label="알림">
          <IconBell width={18} height={18} />
          <span className="absolute top-1 right-1 min-w-4 h-4 bg-danger text-white text-[0.62rem] font-bold rounded-full flex items-center justify-center px-1 leading-none border-[1.5px] border-background">3</span>
        </a>
      </div>
    </div>
  );
}
