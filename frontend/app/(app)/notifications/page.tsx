'use client';

/**
 * 알림 페이지.
 * 리스트에서는 제목·시간만 노출, 클릭 시 상세 모달로 내용 확인.
 * 읽지 않은 알림 클릭 시 읽음 처리 + 토스트 알림.
 * "모두 읽음" 클릭 시 전체 읽음 처리 + 토스트.
 */
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import AppShell from '@/components/AppShell';
import Modal from '@/components/Modal';
import Pagination, { LimitSelect } from '@/components/Pagination';
import { IconAlertTriangle, IconCube, IconLock, IconFolder } from '@/components/icons';
import { api } from '@/lib/api';
import { TONE_CLASS, NOTI_TABS, relativeTime, type Noti } from '@/lib/notification';

// 발생처/톤으로 아이콘 결정
function iconFor(n: Noti): ReactNode {
  if (n.source.includes('계정')) return <IconLock width={17} height={17} />;
  if (n.source.includes('파일')) return <IconFolder width={17} height={17} />;
  if (n.tone === 'warning') return <IconAlertTriangle width={17} height={17} />;
  return <IconCube width={17} height={17} />;
}

export default function NotificationsPage() {
  const [items, setItems] = useState<Noti[]>([]);
  const [tab, setTab] = useState<typeof NOTI_TABS[number]['kind']>('all');
  const changeTab = (t: typeof tab) => { setTab(t); setPage(1); };
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<Noti | null>(null);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

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

  // 알림 클릭 — 상세 모달 열기 + 읽지 않은 경우 읽음 처리
  async function openDetail(n: Noti) {
    setDetail(n);
    if (n.read) return;

    // 낙관적 갱신
    setItems((prev) => prev.map((item) => (item.id === n.id ? { ...item, read: true } : item)));
    try {
      await api.put(`/notifications/${n.id}/read`, {});
      toast.success('알림을 읽음 처리했습니다.');
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
      toast.success('모든 알림을 읽음 처리했습니다.');
    } catch (e) {
      setError((e as Error).message);
      toast.error('읽음 처리에 실패했습니다.');
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

  const totalPages = Math.ceil(filtered.length / limit);
  const paged = filtered.slice((page - 1) * limit, page * limit);

  return (
    <AppShell activePath="/notifications" topbarLabel="알림">
      <div className="page-header">
        <div>
          <h1 className="page-title">알림</h1>
          <p className="page-subtitle">
            {unreadCount > 0 ? `읽지 않은 알림 ${unreadCount}개가 있습니다.` : '모든 알림을 읽었습니다.'}
          </p>
        </div>
        <button type="button" className="btn btn-ghost" onClick={markAllRead}>모두 읽음</button>
      </div>

      {error && <p className="ledger-note is-error">⚠️ {error}</p>}

      {/* 필터 탭 + 페이지당 항목 수 */}
      <div className="flex-center" style={{ justifyContent: 'space-between' }}>
        <div className="notif-tabs">
          {NOTI_TABS.map((t) => (
            <button key={t.kind} type="button" className={`btn ${tab === t.kind ? 'btn-primary' : 'btn-ghost'}`} onClick={() => changeTab(t.kind)}>
              {t.label}
            </button>
          ))}
        </div>
        <LimitSelect limit={limit} onLimitChange={(n) => { setLimit(n); setPage(1); }} />
      </div>

      {/* 알림 리스트 — 리스트에서는 desc 미노출, 클릭 시 상세 모달 */}
      <div className="card flush">
        {paged.length === 0 && <p className="muted-note notif-empty">알림이 없습니다.</p>}
        {paged.map((n) => (
          <div
            key={n.id}
            className={`notif-item${n.read ? '' : ' unread'}`}
            onClick={() => openDetail(n)}
            style={{ cursor: 'pointer' }}
          >
            <div className={`notif-dot ${n.read ? 'read' : 'unread'}`} />
            <div className={`notif-type-icon ${TONE_CLASS[n.tone]}`}>{iconFor(n)}</div>
            <div className="notif-main">
              <div className="notif-title">{n.title}</div>
              <div className="notif-time">{relativeTime(n.occurredAt)} · {n.source}</div>
            </div>
          </div>
        ))}
        <Pagination page={page} totalPages={totalPages} totalItems={filtered.length} onPageChange={setPage} />
      </div>

      {/* 상세 모달 */}
      {detail && (
        <Modal open={!!detail} title="알림 상세" onClose={() => setDetail(null)}>
          <div className="notif-detail">
            {/* 아이콘 원형 — 컨펌 모달과 동일한 스타일 */}
            <div className={`notif-detail-icon notif-detail-icon--${detail.tone}`}>
              {iconFor(detail)}
            </div>

            {/* 제목 + 읽음 여부 뱃지 */}
            <div className="notif-detail-title-row">
              <p className="notif-detail-title">{detail.title}</p>
              {!detail.read && <span className="notif-detail-unread-badge">읽지 않음</span>}
            </div>

            {/* 출처 · 시간 */}
            <p className="notif-detail-meta">
              <span>{detail.source}</span>
              <span className="notif-detail-sep">·</span>
              <span>{relativeTime(detail.occurredAt)}</span>
            </p>

            {/* 내용 */}
            <p className="notif-detail-desc">{detail.desc}</p>
          </div>
        </Modal>
      )}
    </AppShell>
  );
}
