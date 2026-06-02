'use client';

/**
 * 알림 페이지.
 * 알림을 필터 탭(전체/읽지않음/가계부/시스템)으로 보고, 클릭 또는 "모두 읽음"으로 읽음 처리한다.
 * 공통 레이아웃(AppShell)을 재사용하고 데이터는 더미로 채운다.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import AppShell from '@/components/AppShell';
import { IconAlertTriangle, IconCube, IconLock, IconFolder } from '@/components/icons';

type NotiTone = 'warning' | 'success' | 'muted';
type NotiGroup = '가계부' | '시스템';

interface Noti {
  id: number; tone: NotiTone; icon: ReactNode; group: NotiGroup;
  title: string; desc: string; time: string; read: boolean;
}

// ── 더미 데이터 (TODO: GET /api/v1/notifications) ───────────────
const INITIAL: Noti[] = [
  { id: 1, tone: 'warning', icon: <IconAlertTriangle width={17} height={17} />, group: '가계부', title: '구독 예산 90% 초과', desc: '이번 달 구독 지출이 예산(₩200,000)의 94%에 달했습니다. 미사용 구독 서비스 정리를 권장합니다.', time: '1시간 전 · 가계부', read: false },
  { id: 2, tone: 'success', icon: <IconCube width={17} height={17} />, group: '시스템', title: '4월 AI 리포트 생성 완료', desc: '2025년 4월 소비 분석 리포트가 준비됐습니다. 이번 달 식비가 27% 감소했습니다.', time: '3일 전 · AI 리포트', read: false },
  { id: 3, tone: 'warning', icon: <IconAlertTriangle width={17} height={17} />, group: '가계부', title: '식비 예산 78% 도달', desc: '이번 달 식비가 예산(₩400,000)의 78%에 도달했습니다.', time: '5일 전 · 가계부', read: false },
  { id: 4, tone: 'muted', icon: <IconLock width={17} height={17} />, group: '시스템', title: '계정 추가됨 — GitHub', desc: '새 계정이 계정 보관함에 암호화되어 저장됐습니다.', time: '1주일 전 · 계정 보관함', read: true },
  { id: 5, tone: 'muted', icon: <IconFolder width={17} height={17} />, group: '시스템', title: '파일 업로드 완료 — 보험증권_2025.pdf', desc: '파일이 Cloudflare R2에 안전하게 저장됐습니다.', time: '1주일 전 · 파일 보관함', read: true },
];

const TABS = ['전체', '읽지 않음', '가계부', '시스템'] as const;
type Tab = typeof TABS[number];

export default function NotificationsPage() {
  const router = useRouter();
  const [items, setItems] = useState<Noti[]>(INITIAL);
  const [tab, setTab] = useState<Tab>('전체');

  // 인증 가드 — 토큰 없으면 로그인 페이지로. TODO: 토큰 유효성 검증 API 연동
  useEffect(() => {
    if (!localStorage.getItem('auth_token')) {
      router.replace('/login');
    }
  }, [router]);

  // 로그아웃 — 토큰 제거 후 로그인 페이지로 이동
  function logout() {
    localStorage.removeItem('auth_token');
    router.push('/login');
  }

  // 단일 알림 읽음 처리. TODO: PATCH /api/v1/notifications/:id/read
  function markRead(id: number) {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  }

  // 전체 읽음 처리. TODO: PATCH /api/v1/notifications/read-all
  function markAllRead() {
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
  }

  const unreadCount = items.filter((n) => !n.read).length;

  // 탭 기준 필터링
  const filtered = items.filter((n) => {
    if (tab === '전체') return true;
    if (tab === '읽지 않음') return !n.read;
    return n.group === tab;
  });

  // 상단바 우측: 모두 읽음 버튼 (dark/bell 은 유지)
  const topbarRight = (
    <button type="button" className="btn btn-ghost" onClick={markAllRead}>모두 읽음</button>
  );

  return (
    <AppShell activePath="/notifications" topbarLabel="알림" topbarRight={topbarRight} onLogout={logout}>
      <div className="page-header">
        <h1 className="page-title">알림</h1>
        <p className="page-subtitle">
          {unreadCount > 0 ? `읽지 않은 알림 ${unreadCount}개가 있습니다.` : '모든 알림을 읽었습니다.'}
        </p>
      </div>

      {/* 필터 탭 */}
      <div className="notif-tabs">
        {TABS.map((t) => (
          <button key={t} type="button" className={`btn ${tab === t ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>

      {/* 알림 리스트 */}
      <div className="card flush">
        {filtered.map((n) => (
          <div key={n.id} className={`notif-item${n.read ? '' : ' unread'}`} onClick={() => markRead(n.id)}>
            <div className={`notif-dot ${n.read ? 'read' : 'unread'}`} />
            <div className={`notif-type-icon ${n.tone}`}>{n.icon}</div>
            <div className="notif-main">
              <div className="notif-title">{n.title}</div>
              <div className="notif-desc">{n.desc}</div>
              <div className="notif-time">{n.time}</div>
            </div>
          </div>
        ))}
      </div>
    </AppShell>
  );
}
