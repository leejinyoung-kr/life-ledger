'use client';

/**
 * 공통 앱 레이아웃 셸 (Tailwind).
 * 데스크톱: 사이드바 + 상단바 + 본문(최대 1200). 휴대폰: 상단바 + 본문 + 아래 메뉴 + '전체 메뉴' 시트.
 * 모든 인증 페이지(대시보드 등)가 이 셸로 콘텐츠를 감싼다.
 */
import { useCallback, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import BottomNav from './BottomNav';
import MoreSheet from './MoreSheet';
import VaultUnlockModal from './VaultUnlockModal';
import { api } from '@/lib/api';

interface AppShellProps {
  /** 현재 경로 (메뉴 선택 표시) */
  activePath?: string;
  /** 로그아웃 핸들러 (미지정 시 기본 동작: 토큰 제거 후 /login 이동) */
  onLogout?: () => void;
  /** 본문 여백 래퍼 없이 children 직접 렌더 (전체 높이 레이아웃용) */
  bare?: boolean;
  /** 페이지 콘텐츠 */
  children: ReactNode;
}

export default function AppShell({ activePath, onLogout, bare, children }: AppShellProps) {
  const router = useRouter();
  const [moreOpen, setMoreOpen] = useState(false);
  const closeMore = useCallback(() => setMoreOpen(false), []);

  // 기본 로그아웃 — 서버 refresh 쿠키 + 로컬 토큰 제거 후 로그인 페이지로. onLogout 지정 시 그것을 우선
  const handleLogout = onLogout ?? (async () => {
    await api.logout();
    router.push('/login');
  });

  return (
    <>
      <div className="flex min-h-screen">
        <Sidebar activePath={activePath} onLogout={handleLogout} />
        <div className="ml-[var(--sidebar-w)] flex-1 min-w-0 min-h-screen flex flex-col max-md:ml-0 max-md:pb-[calc(60px+env(safe-area-inset-bottom))]">
          <TopBar />
          {bare ? children : <main className="w-full max-w-[calc(var(--content-max)+64px)] mx-auto p-8 max-md:p-4 overflow-x-hidden">{children}</main>}
        </div>
      </div>
      <BottomNav activePath={activePath} moreOpen={moreOpen} onMore={() => setMoreOpen((v) => !v)} />
      <MoreSheet open={moreOpen} activePath={activePath} onClose={closeMore} onLogout={handleLogout} />
      {/* 마스터 잠금 해제 모달 — reveal 류 요청 423 시 자동 표시 */}
      <VaultUnlockModal />
    </>
  );
}
