'use client';

/**
 * 알림 페이지.
 * 알림을 필터 탭(전체/읽지않음/가계부/시스템)으로 보고, 클릭 또는 "모두 읽음"으로 읽음 처리한다.
 * 데이터는 백엔드 API(/notifications)와 연동한다.
 */
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import AppShell from '@/components/AppShell';
import { IconAlertTriangle, IconCube, IconLock, IconFolder } from '@/components/icons';
import { api } from '@/lib/api';
import { TONE_CLASS, NOTI_TABS, relativeTime, type Noti } from '@/lib/notification';

// 발생처/톤으로 아이콘 결정 (계정·파일은 전용, 그 외 톤 기준)
function iconFor(n: Noti): ReactNode {
  if (n.source.includes('계정')) return <IconLock width={17} height={17} />;
  if (n.source.includes('파일')) return <IconFolder width={17} height={17} />;
  if (n.tone === 'warning') return <IconAlertTriangle width={17} height={17} />;
  return <IconCube width={17} height={17} />;
}

export default function NotificationsPage() {
  const [items, setItems] = useState<Noti[]>([]);
  const [tab, setTab] = useState<typeof NOTI_TABS[number]['kind']>('all');
  const [error, setError] = useState<string | null>(null);

  // 알림 목록 조회
  const load = useCallback(async () => {
    try {
      setItems(await api.get<Noti[]>('/notifications'));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // 단일 알림 읽음 처리 (낙관적 갱신 후 PATCH)
  async function markRead(id: number) {
    const target = items.find((n) => n.id === id);
    if (!target || target.read) return;
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    try {
      await api.put(`/notifications/${id}/read`, {});
    } catch (e) {
      setError((e as Error).message);
      load();
    }
  }

  // 전체 읽음 처리
  async function markAllRead() {
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    try {
      await api.put('/notifications/read-all', {});
    } catch (e) {
      setError((e as Error).message);
      load();
    }
  }

  const unreadCount = items.filter((n) => !n.read).length;

  // 탭 기준 필터링
  const filtered = items.filter((n) => {
    if (tab === 'all') return true;
    if (tab === 'unread') return !n.read;
    return n.group === tab;
  });

  // 상단바 우측: 모두 읽음 버튼
  const topbarRight = (
    <button type="button" className="btn btn-ghost" onClick={markAllRead}>모두 읽음</button>
  );

  return (
    <AppShell activePath="/notifications" topbarLabel="알림" topbarRight={topbarRight}>
      <div className="page-header">
        <h1 className="page-title">알림</h1>
        <p className="page-subtitle">
          {unreadCount > 0 ? `읽지 않은 알림 ${unreadCount}개가 있습니다.` : '모든 알림을 읽었습니다.'}
        </p>
      </div>

      {error && <p className="ledger-note is-error">⚠️ {error}</p>}

      {/* 필터 탭 */}
      <div className="notif-tabs">
        {NOTI_TABS.map((t) => (
          <button key={t.kind} type="button" className={`btn ${tab === t.kind ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab(t.kind)}>{t.label}</button>
        ))}
      </div>

      {/* 알림 리스트 */}
      <div className="card flush">
        {filtered.length === 0 && <p className="muted-note notif-empty">알림이 없습니다.</p>}
        {filtered.map((n) => (
          <div key={n.id} className={`notif-item${n.read ? '' : ' unread'}`} onClick={() => markRead(n.id)}>
            <div className={`notif-dot ${n.read ? 'read' : 'unread'}`} />
            <div className={`notif-type-icon ${TONE_CLASS[n.tone]}`}>{iconFor(n)}</div>
            <div className="notif-main">
              <div className="notif-title">{n.title}</div>
              <div className="notif-desc">{n.desc}</div>
              <div className="notif-time">{relativeTime(n.occurredAt)} · {n.source}</div>
            </div>
          </div>
        ))}
      </div>
    </AppShell>
  );
}
