'use client';

/**
 * 알림 페이지.
 * 목록에는 제목 · 본문 첫 줄 · 시각 · 출처, 클릭 시 상세 창(알림 상세)으로 내용 확인.
 * 읽지 않은 알림을 열면 읽음 처리(토스트 없음). "모두 읽음" 은 전체 읽음 처리 + 토스트.
 */
import { useMemo, useState } from 'react';
import { notify } from '@/lib/toast';
import { useApiQuery, useInvalidate, type Paginated } from '@/lib/query';
import { qk } from '@/lib/queryKeys';
import AppShell from '@/components/AppShell';
import PageHeader from '@/components/PageHeader';
import Modal from '@/components/Modal';
import Button from '@/components/ui/Button';
import IconButton from '@/components/ui/IconButton';
import Segmented from '@/components/ui/Segmented';
import Pagination, { LimitSelect } from '@/components/Pagination';
import ErrorBanner from '@/components/ErrorBanner';
import EmptyState from '@/components/EmptyState';
import { Card } from '@/components/ui/Card';
import { useConfirm } from '@/components/ConfirmModal';
import { IconCheck, IconChevronRight, IconClose } from '@/components/icons';
import { api } from '@/lib/api';
import { NOTI_TABS, SOURCE_ICON, SOURCE_LINK, FALLBACK_SOURCE_ICON, relativeTime, type Noti, type NotiTone } from '@/lib/notification';
import { usePagination } from '@/lib/usePagination';
import { useRowSelection } from '@/lib/useRowSelection';

// tone → 종류 아이콘 색 (info 는 muted)
const ICON_TONE: Record<NotiTone, string> = {
  warning: 'text-warning',
  success: 'text-success',
  info: 'text-muted',
};

// ISO → 'YYYY.MM.DD HH:mm' (상세 창의 받은 시각)
function formatReceived(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

// 출처에 맞는 종류 아이콘
function SourceIcon({ source, size }: { source: string; size: number }) {
  const Icon = SOURCE_ICON[source] ?? FALLBACK_SOURCE_ICON;
  return <Icon width={size} height={size} />;
}

export default function NotificationsPage() {
  const [tab, setTab] = useState<typeof NOTI_TABS[number]['kind']>('all');
  const handleChangeTab = (t: typeof tab) => { setTab(t); setPage(1); clear(); };
  const [detail, setDetail] = useState<Noti | null>(null);
  const { page, setPage, limit, changeLimit } = usePagination();
  const { confirm, confirmElement } = useConfirm();
  const invalidate = useInvalidate();

  // 알림 목록 (React Query 캐시) — 서버 페이징/그룹필터. 미읽음 수는 별도 집계 엔드포인트
  const listQs = useMemo(() => {
    const params = new URLSearchParams();
    if (tab !== 'all') params.set('group', tab);
    params.set('page', String(page));
    params.set('limit', String(limit));
    return params.toString();
  }, [tab, page, limit]);
  const itemsQuery = useApiQuery<Paginated<Noti>>(qk.notifications.list({ tab, page, limit }), `/notifications?${listQs}`);
  const unreadQuery = useApiQuery<{ count: number }>(qk.notifications.unread(), '/notifications/unread-count');
  const items = useMemo(() => itemsQuery.data?.items ?? [], [itemsQuery.data]);
  const total = itemsQuery.data?.total ?? 0;
  const unreadCount = unreadQuery.data?.count ?? 0;
  const error = itemsQuery.error?.message ?? null;
  const reload = () => invalidate(qk.notifications.all);

  // 알림 클릭 — 상세 창 열기 + 읽지 않은 경우 읽음 처리 (여는 것 자체가 읽음이라 토스트는 띄우지 않는다)
  async function handleOpenDetail(n: Noti) {
    setDetail(n);
    if (n.read) return;
    try {
      await api.put(`/notifications/${n.id}/read`, {});
      reload();
    } catch (e) {
      notify.error((e as Error).message);
    }
  }

  // 선택삭제
  async function handleRemoveSelected() {
    if (!selected.size) return;
    if (!await confirm(`선택한 알림 ${selected.size}건을 삭제할까요?`, 'danger')) return;
    try {
      await api.del('/notifications/bulk', { ids: [...selected] });
      notify.deleted(`알림 ${selected.size}건`);
      clear();
      reload();
    } catch {
      notify.deleteFailed();
    }
  }

  // 전체삭제
  async function handleRemoveAll() {
    if (!total) return;
    if (!await confirm('모든 알림을 삭제할까요?', 'danger')) return;
    try {
      await api.del('/notifications');
      notify.deleted('모든 알림');
      clear();
      reload();
    } catch {
      notify.deleteFailed();
    }
  }

  // 전체 읽음 처리
  async function handleMarkAllRead() {
    try {
      await api.put('/notifications/read-all', {});
      notify.success('모든 알림을 읽음 처리했습니다.');
      reload();
    } catch {
      notify.error('읽음 처리에 실패했습니다.');
    }
  }

  const totalPages = Math.ceil(total / limit);
  const paged = items; // 서버가 이미 그룹필터+페이지 단위로 잘라서 보냄
  const { selected, toggle, toggleAll, clear, allChecked } = useRowSelection(paged.map((n) => n.id));

  const detailLink = detail ? SOURCE_LINK[detail.source] : undefined;

  return (
    <AppShell activePath="/notifications">
      <PageHeader
        title="알림"
        description={unreadCount > 0 ? `읽지 않은 알림 ${unreadCount}개가 있습니다.` : '모든 알림을 읽었습니다.'}
        actions={<Button variant="ghost" onClick={handleMarkAllRead}><IconCheck />모두 읽음</Button>}
      />

      <ErrorBanner message={error} />

      {/* 거르기 알약 + 선택삭제/전체삭제 + 페이지당 항목 수 */}
      <div className="flex items-center justify-between gap-2 pb-3 flex-wrap">
        <Segmented
          label="알림 구분"
          value={tab}
          onChange={handleChangeTab}
          items={NOTI_TABS.map((t) => ({ value: t.kind, label: t.label }))}
        />
        <div className="flex items-center gap-1 flex-wrap justify-end">
          <Button variant="danger" size="sm" disabled={selected.size === 0} onClick={handleRemoveSelected}>선택삭제</Button>
          <Button variant="danger" size="sm" onClick={handleRemoveAll}>전체삭제</Button>
          <LimitSelect limit={limit} onLimitChange={changeLimit} />
        </div>
      </div>

      {/* 알림 목록 — 흰 카드 안 줄 목록, 클릭 시 상세 창 */}
      <Card clip className="flex flex-col">
        {paged.length > 0 && (
          <div className="flex items-center gap-3 h-10 px-4 bg-surface border-b border-border text-[0.78rem] text-muted">
            <input
              type="checkbox"
              className="checkbox"
              checked={allChecked}
              onChange={toggleAll}
              aria-label="전체선택"
            />
            {selected.size > 0 ? `${selected.size}건 선택됨` : '전체선택'}
          </div>
        )}
        {paged.length === 0 && <EmptyState size="lg" message="알림이 없습니다." />}
        {paged.map((n) => {
          return (
            <div
              key={n.id}
              className="flex items-start gap-3 px-4 py-3 border-b border-border-subtle last:border-b-0 cursor-pointer transition-colors hover:bg-surface max-md:min-h-11"
              onClick={() => handleOpenDetail(n)}
            >
              <input
                type="checkbox"
                className="checkbox mt-0.5"
                checked={selected.has(n.id)}
                onChange={() => toggle(n.id)}
                onClick={(e) => e.stopPropagation()}
                aria-label="선택"
              />
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 mt-2.25 ${n.read ? 'bg-transparent' : 'bg-accent'}`} aria-label={n.read ? undefined : '읽지 않음'} />
              <span className={`w-7.5 h-7.5 shrink-0 border border-border rounded-ui flex items-center justify-center ${ICON_TONE[n.tone]}`}>
                <SourceIcon source={n.source} size={15} />
              </span>
              <div className="flex-1 min-w-0 flex flex-col leading-[1.45]">
                <span className={`text-[0.875rem] ${n.read ? 'text-secondary' : 'text-primary font-semibold'}`}>{n.title}</span>
                <span className="text-[0.8125rem] text-muted truncate">{n.desc}</span>
                <span className="text-[0.72rem] text-muted">{relativeTime(n.occurredAt)} · {n.source}</span>
              </div>
            </div>
          );
        })}
      </Card>
      <Pagination page={page} totalPages={totalPages} totalItems={total} onPageChange={setPage} />

      {/* 알림 상세 창 */}
      {detail && (
        <Modal
          open
          size="sm"
          title="알림 상세"
          onClose={() => setDetail(null)}
          header={(
            <div className="flex items-start gap-3 px-5 py-4 border-b border-border-subtle">
              <span className={`w-9 h-9 shrink-0 border border-border rounded-ui flex items-center justify-center ${ICON_TONE[detail.tone]}`}>
                <SourceIcon source={detail.source} size={18} />
              </span>
              <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                <span className="text-[1.25rem] font-bold leading-tight text-primary break-keep">{detail.title}</span>
                <span className="text-[0.78rem] text-muted">{relativeTime(detail.occurredAt)} · {detail.source}</span>
              </div>
              <IconButton label="닫기" variant="bordered" size="lg" onClick={() => setDetail(null)}>
                <IconClose />
              </IconButton>
            </div>
          )}
          footer={(
            <>
              <Button variant="ghost" onClick={() => setDetail(null)}>닫기</Button>
              {detailLink && <Button href={detailLink.href}>{detailLink.label}로 이동<IconChevronRight /></Button>}
            </>
          )}
        >
          <p className="text-[0.875rem] leading-[1.65] text-primary break-keep">{detail.desc}</p>
          <dl className="grid grid-cols-[64px_1fr] gap-x-3 gap-y-1.5 text-[0.78rem]">
            <dt className="text-muted">받은 시각</dt>
            <dd className="text-primary">{formatReceived(detail.occurredAt)}</dd>
            <dt className="text-muted">출처</dt>
            <dd className="text-primary">{detail.source}</dd>
          </dl>
        </Modal>
      )}
      {confirmElement}
    </AppShell>
  );
}
