'use client';

/**
 * 휴지통 페이지.
 * 모든 도메인의 삭제(soft-delete) 항목을 모아 복구/영구삭제한다. (30일 경과 시 자동 영구 삭제)
 * 데이터는 백엔드 API(/trash)와 연동한다.
 * 스타일: Tailwind + 공통 컴포넌트(Button/Pagination). 가계부와 동일한 표+모바일카드 패턴.
 */
import { useMemo, useState } from 'react';
import AppShell from '@/components/AppShell';
import { useConfirm } from '@/components/ConfirmModal';
import Pagination, { LimitSelect } from '@/components/Pagination';
import Button from '@/components/ui/Button';
import { notify } from '@/lib/toast';
import { useApiQuery, useInvalidate, type Paginated } from '@/lib/query';
import { qk } from '@/lib/queryKeys';
import { IconAlertCircle, IconSearch } from '@/components/icons';
import { api } from '@/lib/api';
import { trashDate, type TrashItem } from '@/lib/trash';

export default function TrashPage() {
  const [query, setQuery] = useState('');
  const [type, setType] = useState('전체 유형');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const { confirm, confirmElement } = useConfirm();
  const invalidate = useInvalidate();

  // 삭제 항목 통합 목록 (React Query 캐시) — 서버 페이징/필터. types=유형 드롭다운용
  const listQs = useMemo(() => {
    const params = new URLSearchParams();
    if (type !== '전체 유형') params.set('type', type);
    if (query.trim()) params.set('q', query.trim());
    params.set('page', String(page));
    params.set('limit', String(limit));
    return params.toString();
  }, [type, query, page, limit]);
  const itemsQuery = useApiQuery<Paginated<TrashItem> & { types: string[] }>(qk.trash.list({ type, q: query.trim(), page, limit }), `/trash?${listQs}`);
  const items = useMemo(() => itemsQuery.data?.items ?? [], [itemsQuery.data]);
  const total = itemsQuery.data?.total ?? 0;
  const serverTypes = useMemo(() => itemsQuery.data?.types ?? [], [itemsQuery.data]);
  const error = itemsQuery.error?.message ?? null;
  // 복구/삭제는 휴지통 + 복원 대상 도메인에 영향 → 전체 무효화
  const reload = () => invalidate();

  // 단일 복구
  async function restore(it: TrashItem) {
    if (!await confirm(`'${it.name}'을(를) 복구할까요?`, 'primary')) return;
    try {
      await api.post('/trash/restore', { kind: it.kind, id: it.id });
      notify.success(`'${it.name}'을(를) 복구했습니다.`);
      reload();
    } catch (e) { notify.error((e as Error).message); }
  }

  // 단일 영구 삭제
  async function purge(it: TrashItem) {
    if (!await confirm(`'${it.name}'을(를) 영구 삭제할까요? 되돌릴 수 없습니다.`, 'danger')) return;
    try {
      await api.post('/trash/purge', { kind: it.kind, id: it.id });
      notify.purged();
      reload();
    } catch (e) { notify.error((e as Error).message); }
  }

  function toggleSelect(key: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  function toggleSelectAll() {
    const keys = paged.map((it) => `${it.kind}-${it.id}`);
    const allSelected = keys.length > 0 && keys.every((k) => selected.has(k));
    setSelected(allSelected ? new Set() : new Set(keys));
  }

  async function bulkRestoreSelected() {
    if (selected.size === 0) return;
    if (!await confirm(`선택한 ${selected.size}건을 복구할까요?`, 'primary')) return;
    const items = [...selected].map((key) => {
      const [kind, idStr] = key.split('-');
      return { kind, id: Number(idStr) };
    });
    try {
      await api.post('/trash/bulk-restore', { items });
      notify.success(`${selected.size}건을 복구했습니다.`);
      setSelected(new Set());
      reload();
    } catch (e) { notify.error((e as Error).message); }
  }

  async function bulkPurgeSelected() {
    if (selected.size === 0) return;
    if (!await confirm(`선택한 ${selected.size}건을 영구 삭제할까요? 되돌릴 수 없습니다.`, 'danger')) return;
    const items = [...selected].map((key) => {
      const [kind, idStr] = key.split('-');
      return { kind, id: Number(idStr) };
    });
    try {
      await api.post('/trash/bulk-purge', { items });
      notify.purged();
      setSelected(new Set());
      reload();
    } catch (e) { notify.error((e as Error).message); }
  }

  // 전체 복구
  async function restoreAll() {
    if (total === 0) return;
    if (!await confirm('모든 삭제 항목을 복구할까요?', 'primary')) return;
    try {
      await api.post('/trash/restore-all', {});
      notify.restoredAll();
      reload();
    } catch (e) { notify.error((e as Error).message); }
  }

  // 휴지통 비우기 (전체 영구 삭제)
  async function emptyTrash() {
    if (total === 0) return;
    if (!await confirm('휴지통을 비울까요? 모든 항목이 영구 삭제됩니다.', 'danger')) return;
    try {
      await api.post('/trash/empty', {});
      notify.emptied();
      reload();
    } catch (e) { notify.error((e as Error).message); }
  }

  // 유형 필터 옵션 — 서버가 준 distinct 라벨에서 구성
  const types = useMemo(() => ['전체 유형', ...serverTypes], [serverTypes]);

  const totalPages = Math.ceil(total / limit);
  const paged = items; // 서버가 이미 필터+페이지 단위로 잘라서 보냄

  return (
    <AppShell activePath="/trash" topbarLabel="휴지통">
      <div className="mb-7">
        <h1 className="[font-family:var(--font-display)] text-[1.55rem] font-bold tracking-[-0.03em] text-primary">휴지통</h1>
        <p className="text-sm text-secondary mt-1.5">삭제한 항목은 30일간 보관 후 자동으로 영구 삭제됩니다.</p>
      </div>

      <div className="flex items-center gap-2.5 px-4 py-3 bg-surface border border-border rounded-[var(--radius)] mb-5 text-[0.82rem] text-secondary [&>svg]:text-muted [&>svg]:shrink-0">
        <IconAlertCircle width={16} height={16} />
        모든 보관함(가계부·예적금·투자·구독·자산·할일·목표·메모·일정)의 삭제 항목이 모입니다. 30일 경과 시 복구 불가.
      </div>

      {error && <p className="mt-3 mb-3 text-[0.78rem] text-danger">⚠️ {error}</p>}

      {/* 검색 / 유형 필터 / 일괄 액션 */}
      <div className="bg-surface border border-border rounded-[var(--radius-lg)] px-5 py-4 flex gap-2 items-center mb-4 max-md:flex-wrap">
        <div className="relative flex-1 min-w-[160px]">
          <IconSearch className="absolute left-[11px] top-1/2 -translate-y-1/2 text-muted w-[15px] h-[15px] pointer-events-none" />
          <input className="input pl-icon" type="text" placeholder="삭제 항목 검색..." value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }} onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()} aria-label="삭제 항목 검색" />
        </div>
        <select className="input w-auto min-w-[120px] shrink-0" value={type} onChange={(e) => { setType(e.target.value); setPage(1); }} aria-label="유형 필터">
          {types.map((t) => <option key={t}>{t}</option>)}
        </select>
        {selected.size > 0 && <Button variant="ghost" onClick={bulkRestoreSelected}>{selected.size}건 복구</Button>}
        {selected.size > 0 && <Button variant="danger" onClick={bulkPurgeSelected}>{selected.size}건 영구삭제</Button>}
        <Button variant="ghost" onClick={restoreAll}>전체 복구</Button>
        <Button variant="danger" onClick={emptyTrash}>휴지통 비우기</Button>
      </div>

      <div className="flex items-center justify-between mb-2">
        <span className="text-[0.78rem] text-secondary">총 {total}건</span>
        <LimitSelect limit={limit} onLimitChange={(n) => { setLimit(n); setPage(1); }} />
      </div>

      {/* 삭제 항목 — 표 + 모바일 카드 */}
      <div className="bg-background border border-border rounded-[var(--radius-lg)] shadow-[var(--shadow-sm)] overflow-hidden">
        <div className="table-wrap max-md:hidden">
          <table>
            <colgroup>
              <col style={{ width: '40px' }} />
              <col style={{ width: '64px' }} />
              <col />
              <col style={{ width: '120px' }} />
              <col style={{ width: '120px' }} />
              <col style={{ width: '100px' }} />
              <col style={{ width: '170px' }} />
            </colgroup>
            <thead>
              <tr>
                <th className="td-center"><input type="checkbox" className="checkbox" checked={paged.length > 0 && paged.every((it) => selected.has(`${it.kind}-${it.id}`))} onChange={toggleSelectAll} aria-label="전체선택" /></th>
                <th>번호</th><th>이름</th><th>유형</th><th>삭제일</th><th>남은 기간</th><th>관리</th>
              </tr>
            </thead>
            <tbody>
              {paged.length === 0 && (
                <tr><td colSpan={7} className="td-center td-muted">휴지통이 비어 있습니다.</td></tr>
              )}
              {paged.map((it, i) => (
                <tr key={`${it.kind}-${it.id}`}>
                  <td className="td-center"><input type="checkbox" className="checkbox" checked={selected.has(`${it.kind}-${it.id}`)} onChange={() => toggleSelect(`${it.kind}-${it.id}`)} aria-label="선택" /></td>
                  <td className="td-center td-muted">{total - (page - 1) * limit - i}</td>
                  <td className="td-name">{it.name}</td>
                  <td className="td-center"><span className="type-chip">{it.chip}</span></td>
                  <td className="td-center td-muted">{trashDate(it.deletedAt)}</td>
                  <td className={`td-center ${it.daysLeft <= 2 ? 'text-danger font-semibold' : 'td-muted'}`}>{it.daysLeft}일</td>
                  <td className="td-center">
                    <div className="flex justify-center gap-1">
                      <Button variant="ghost" size="sm" onClick={() => restore(it)}>복구</Button>
                      <Button variant="danger" size="sm" onClick={() => purge(it)}>영구삭제</Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 모바일 카드 */}
        <div className="hidden max-md:flex flex-col gap-2.5 p-3">
          {paged.length === 0 && <div className="text-center text-muted py-7">휴지통이 비어 있습니다.</div>}
          {paged.map((it) => (
            <div className="border border-border rounded-[var(--radius-lg)] p-3.5 bg-background" key={`${it.kind}-${it.id}`}>
              <div className="flex items-baseline gap-2 justify-between">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <input type="checkbox" className="checkbox self-center" checked={selected.has(`${it.kind}-${it.id}`)} onChange={() => toggleSelect(`${it.kind}-${it.id}`)} aria-label="선택" />
                  <span className="font-semibold text-[0.95rem] break-all">{it.name}</span>
                </div>
                <span className={`text-[0.82rem] whitespace-nowrap ${it.daysLeft <= 2 ? 'text-danger font-semibold' : 'text-muted'}`}>{it.daysLeft}일 남음</span>
              </div>
              <div className="mt-2 text-[0.78rem] text-secondary flex flex-wrap items-center gap-1.5">
                <span className="type-chip">{it.chip}</span>
                <span>{trashDate(it.deletedAt)} 삭제</span>
              </div>
              <div className="flex gap-2 mt-3">
                <Button variant="ghost" className="flex-1" onClick={() => restore(it)}>복구</Button>
                <Button variant="danger" className="flex-1" onClick={() => purge(it)}>영구삭제</Button>
              </div>
            </div>
          ))}
        </div>

        <Pagination page={page} totalPages={totalPages} totalItems={total} onPageChange={setPage} />
      </div>
      {confirmElement}
    </AppShell>
  );
}
