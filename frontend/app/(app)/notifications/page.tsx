'use client';

/**
 * 알림 페이지.
 * 리스트에서는 제목·시간만 노출, 클릭 시 상세 모달로 내용 확인.
 * 읽지 않은 알림 클릭 시 읽음 처리 + 토스트 알림.
 * "모두 읽음" 클릭 시 전체 읽음 처리 + 토스트.
 * 스타일: Tailwind + 공통 컴포넌트(Button/Badge/Modal/Pagination).
 */
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { notify } from '@/lib/toast';
import AppShell from '@/components/AppShell';
import Modal from '@/components/Modal';
import Button from '@/components/ui/Button';
import Pagination, { LimitSelect } from '@/components/Pagination';
import { useConfirm } from '@/components/ConfirmModal';
import { IconAlertTriangle, IconCube, IconLock, IconFolder } from '@/components/icons';
import { api } from '@/lib/api';
import { NOTI_TABS, relativeTime, type Noti, type NotiTone } from '@/lib/notification';

// tone → 리스트 아이콘 배경/색 (info 는 muted 재사용)
const ICON_TONE: Record<NotiTone, string> = {
  warning: 'bg-warning-dim text-warning',
  success: 'bg-accent-dim text-accent',
  info: 'bg-elevated text-muted',
};
// tone → 상세 모달 원형 아이콘 (info 는 blue)
const DETAIL_TONE: Record<NotiTone, string> = {
  warning: 'bg-warning-dim text-warning',
  success: 'bg-accent-dim text-accent',
  info: 'bg-blue-dim text-blue',
};

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
  const changeTab = (t: typeof tab) => { setTab(t); setPage(1); setSelected(new Set()); };
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<Noti | null>(null);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const { confirm, confirmElement } = useConfirm();

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
      notify.success('알림을 읽음 처리했습니다.');
    } catch (e) {
      setError((e as Error).message);
      load();
    }
  }

  // 체크박스 토글
  function toggleSelect(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleSelectAll(pagedItems: Noti[]) {
    if (selected.size === pagedItems.length && pagedItems.length > 0) {
      setSelected(new Set());
    } else {
      setSelected(new Set(pagedItems.map((n) => n.id)));
    }
  }

  // 선택삭제
  async function removeSelected() {
    if (!selected.size) return;
    if (!await confirm(`선택한 알림 ${selected.size}건을 삭제할까요?`, 'danger')) return;
    try {
      await api.del('/notifications/bulk', { ids: [...selected] });
      notify.deleted(`알림 ${selected.size}건`);
      setSelected(new Set());
      load();
    } catch {
      notify.deleteFailed();
    }
  }

  // 전체삭제
  async function removeAll() {
    if (!items.length) return;
    if (!await confirm('모든 알림을 삭제할까요?', 'danger')) return;
    try {
      await api.del('/notifications');
      notify.deleted('모든 알림');
      setSelected(new Set());
      load();
    } catch {
      notify.deleteFailed();
    }
  }

  // 전체 읽음 처리
  async function markAllRead() {
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    try {
      await api.put('/notifications/read-all', {});
      notify.success('모든 알림을 읽음 처리했습니다.');
    } catch (e) {
      setError((e as Error).message);
      notify.error('읽음 처리에 실패했습니다.');
      load();
    }
  }

  const unreadCount = items.filter((n) => !n.read).length;

  // 탭 기준 필터링
  const filtered = items.filter((n) => {
    if (tab === 'all') return true;
    return n.group === tab;
  });

  const totalPages = Math.ceil(filtered.length / limit);
  const paged = filtered.slice((page - 1) * limit, page * limit);

  return (
    <AppShell activePath="/notifications" topbarLabel="알림">
      <div className="mb-7 flex items-center justify-between gap-4">
        <div>
          <h1 className="[font-family:var(--font-display)] text-[1.55rem] font-bold tracking-[-0.03em] text-primary">알림</h1>
          <p className="text-sm text-secondary mt-1.5">
            {unreadCount > 0 ? `읽지 않은 알림 ${unreadCount}개가 있습니다.` : '모든 알림을 읽었습니다.'}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <Button variant="danger" disabled={selected.size === 0} onClick={removeSelected}>선택삭제</Button>
          <Button variant="ghost" onClick={removeAll}>전체삭제</Button>
          <Button variant="ghost" onClick={markAllRead}>모두 읽음</Button>
        </div>
      </div>

      {error && <p className="mt-3 mb-3 text-[0.78rem] text-danger">⚠️ {error}</p>}

      {/* 필터 탭 + 검색 + 페이지당 항목 수 */}
      {/* 필터 탭 + 페이지당 항목 수 */}
      <div className="flex items-center justify-between gap-2.5 mb-5 max-md:flex-wrap">
        <div className="flex gap-1 flex-wrap">
          {NOTI_TABS.map((t) => (
            <Button key={t.kind} size="sm" variant={tab === t.kind ? 'primary' : 'ghost'} onClick={() => changeTab(t.kind)}>
              {t.label}
            </Button>
          ))}
        </div>
        <LimitSelect limit={limit} onLimitChange={(n) => { setLimit(n); setPage(1); }} />
      </div>

      {/* 알림 리스트 — 리스트에서는 desc 미노출, 클릭 시 상세 모달 */}
      <div className="bg-background border border-border rounded-lg shadow-(--shadow-sm) overflow-hidden">
        {paged.length > 0 && (
          <div className="flex items-center gap-3.5 px-5 py-2.5 border-b border-border-subtle bg-surface">
            <input
              type="checkbox"
              className="checkbox"
              checked={selected.size === paged.length}
              onChange={() => toggleSelectAll(paged)}
              aria-label="전체선택"
            />
            <span className="text-[0.78rem] text-muted">
              {selected.size > 0 ? `${selected.size}건 선택됨` : '전체선택'}
            </span>
          </div>
        )}
        {paged.length === 0 && <p className="text-secondary text-center py-5">알림이 없습니다.</p>}
        {paged.map((n) => (
          <div
            key={n.id}
            className={`flex gap-3.5 px-5 py-4 border-b border-border-subtle last:border-b-0 transition-colors cursor-pointer hover:bg-surface ${n.read ? '' : 'bg-[rgba(0,192,127,0.04)]'}`}
            onClick={() => openDetail(n)}
          >
            <input
              type="checkbox"
              className="checkbox mt-1"
              checked={selected.has(n.id)}
              onChange={() => toggleSelect(n.id)}
              onClick={(e) => e.stopPropagation()}
              aria-label="선택"
            />
            <div className={`w-2 h-2 rounded-full shrink-0 mt-1.5 ${n.read ? 'bg-transparent border-[1.5px] border-border' : 'bg-accent'}`} />
            <div className={`w-9 h-9 rounded-(--radius) shrink-0 flex items-center justify-center ${ICON_TONE[n.tone]}`}>{iconFor(n)}</div>
            <div className="flex-1">
              <div className={`text-[0.875rem] font-medium ${n.read ? 'text-secondary' : 'text-primary'}`}>{n.title}</div>
              <div className="text-[0.72rem] text-muted mt-1">{relativeTime(n.occurredAt)} · {n.source}</div>
            </div>
          </div>
        ))}
        <Pagination page={page} totalPages={totalPages} totalItems={filtered.length} onPageChange={setPage} />
      </div>

      {/* 상세 모달 */}
      {detail && (
        <Modal open={!!detail} title="알림 상세" onClose={() => setDetail(null)}>
          <div className="flex flex-col items-center gap-3 text-center">
            <div className={`w-15 h-15 rounded-full shrink-0 flex items-center justify-center mb-1 ${DETAIL_TONE[detail.tone]}`}>
              {iconFor(detail)}
            </div>

            <p className="text-base font-bold text-primary leading-[1.45] break-keep">{detail.title}</p>

            <p className="flex items-center gap-1.5 text-[0.78rem] text-muted">
              <span>{detail.source}</span>
              <span className="text-border">·</span>
              <span>{relativeTime(detail.occurredAt)}</span>
            </p>

            <p className="w-full text-left text-[0.875rem] text-secondary leading-[1.7] break-keep px-4 py-3.5 mt-1 bg-surface rounded-(--radius) border border-border-subtle">{detail.desc}</p>
          </div>
        </Modal>
      )}
      {confirmElement}
    </AppShell>
  );
}
