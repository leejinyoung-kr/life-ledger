'use client';

/**
 * 공통 앱 레이아웃 셸 (Tailwind).
 * 사이드바 + 상단바 + 페이지 콘텐츠를 묶고, 모바일 사이드바 열림 상태/오버레이를 관리한다.
 * 모든 인증 페이지(대시보드 등)가 이 셸로 콘텐츠를 감싼다.
 */
import { useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import BottomNav from './BottomNav';
import VaultUnlockModal from './VaultUnlockModal';
import { api } from '@/lib/api';

interface AppShellProps {
  /** 현재 경로 (사이드바 active 표시) */
  activePath?: string;
  /** 상단바 좌측 라벨 */
  topbarLabel?: string;
  /** 로그아웃 핸들러 (미지정 시 기본 동작: 토큰 제거 후 /login 이동) */
  onLogout?: () => void;
  /** page-body 패딩 래퍼 없이 children 직접 렌더 (전체 높이 레이아웃용) */
  bare?: boolean;
  /** 페이지 콘텐츠 */
  children: ReactNode;
}

export default function AppShell({
  activePath,
  topbarLabel,
  onLogout,
  bare,
  children,
}: AppShellProps) {
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // 모바일 사이드바 토글
  const toggleSidebar = () => setSidebarOpen((v) => !v);
  // 오버레이 클릭/링크 이동 시 사이드바 닫기
  const closeSidebar = () => setSidebarOpen(false);

  // 기본 로그아웃 — 서버 refresh 쿠키 + 로컬 토큰 제거 후 로그인 페이지로. onLogout 지정 시 그것을 우선
  const handleLogout = onLogout ?? (async () => {
    await api.logout();
    router.push('/login');
  });

  return (
    <>
      {/* 모바일 dim 오버레이 */}
      <div
        className={`${sidebarOpen ? 'block' : 'hidden'} fixed inset-0 bg-black/30 z-[99]`}
        onClick={closeSidebar}
      />
      <div className="flex min-h-screen">
        <Sidebar activePath={activePath} open={sidebarOpen} onLogout={handleLogout} />
        <div className="ml-[var(--sidebar-w)] flex-1 min-h-screen flex flex-col max-md:ml-0 max-md:pb-[calc(60px+env(safe-area-inset-bottom))]">
          <TopBar label={topbarLabel} />
          {bare ? children : <div className="p-8 w-full max-md:p-4">{children}</div>}
        </div>
      </div>
      {/* 모바일 하단 내비게이션 */}
      <BottomNav activePath={activePath} onMore={toggleSidebar} />
      {/* 마스터 잠금 해제 모달 — reveal 류 요청 423 시 자동 표시 */}
      <VaultUnlockModal />
    </>
  );
}
