'use client';

/**
 * 휴지통 페이지.
 * 모든 도메인의 삭제(soft-delete) 항목을 모아 복구/영구삭제한다. (30일 경과 시 자동 영구 삭제)
 * 데이터는 백엔드 API(/trash)와 연동한다.
 * 스타일: Tailwind + 공통 컴포넌트(Button/Pagination). 가계부와 동일한 표+모바일카드 패턴.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import AppShell from '@/components/AppShell';
import { useConfirm } from '@/components/ConfirmModal';
import Pagination, { LimitSelect } from '@/components/Pagination';
import Button from '@/components/ui/Button';
import { toast } from 'sonner';
import { IconAlertCircle, IconSearch } from '@/components/icons';
import { api } from '@/lib/api';
import { trashDate, type TrashItem } from '@/lib/trash';

export default function TrashPage() {
  const [items, setItems] = useState<TrashItem[]>([]);
  const [query, setQuery] = useState('');
  const [type, setType] = useState('전체 유형');
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const { confirm, confirmElement } = useConfirm();

  // 삭제 항목 통합 목록 조회
  const load = useCallback(async () => {
    try {
      setItems(await api.get<TrashItem[]>('/trash'));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // 단일 복구
  async function restore(it: TrashItem) {
    try {
      await api.post('/trash/restore', { kind: it.kind, id: it.id });
      toast.success(`'${it.name}'을(를) 복구했습니다.`);
      load();
    } catch (e) { setError((e as Error).message); }
  }

  // 단일 영구 삭제
  async function purge(it: TrashItem) {
    if (!await confirm(`'${it.name}'을(를) 영구 삭제할까요? 되돌릴 수 없습니다.`, 'danger')) return;
    try {
      await api.post('/trash/purge', { kind: it.kind, id: it.id });
      toast.success('영구 삭제됐습니다.');
      load();
    } catch (e) { setError((e as Error).message); }
  }

  // 전체 복구
  async function restoreAll() {
    if (items.length === 0) return;
    if (!await confirm('모든 삭제 항목을 복구할까요?', 'primary')) return;
    try {
      await api.post('/trash/restore-all', {});
      toast.success('전체 복구됐습니다.');
      load();
    } catch (e) { setError((e as Error).message); }
  }

  // 휴지통 비우기 (전체 영구 삭제)
  async function emptyTrash() {
    if (items.length === 0) return;
    if (!await confirm('휴지통을 비울까요? 모든 항목이 영구 삭제됩니다.', 'danger')) return;
    try {
      await api.post('/trash/empty', {});
      toast.success('휴지통을 비웠습니다.');
      load();
    } catch (e) { setError((e as Error).message); }
  }

  // 유형 필터 옵션 — 현재 항목의 종류에서 동적 구성
  const types = useMemo(() => ['전체 유형', ...Array.from(new Set(items.map((it) => it.type)))], [items]);

  // 검색어 + 유형으로 필터
  const filtered = items.filter((it) => {
    const matchType = type === '전체 유형' || it.type === type;
    const matchQuery = !query.trim() || it.name.toLowerCase().includes(query.toLowerCase());
    return matchType && matchQuery;
  });

  const totalPages = Math.ceil(filtered.length / limit);
  const paged = filtered.slice((page - 1) * limit, page * limit);

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
          <input className="input pl-icon" type="text" placeholder="삭제 항목 검색..." value={query} onChange={(e) => setQuery(e.target.value)} aria-label="삭제 항목 검색" />
        </div>
        <select className="input w-auto min-w-[120px] shrink-0" value={type} onChange={(e) => { setType(e.target.value); setPage(1); }} aria-label="유형 필터">
          {types.map((t) => <option key={t}>{t}</option>)}
        </select>
        <Button variant="ghost" onClick={restoreAll}>전체 복구</Button>
        <Button variant="danger" onClick={emptyTrash}>휴지통 비우기</Button>
      </div>

      <div className="flex items-center justify-between mb-2">
        <span className="text-[0.78rem] text-secondary">총 {filtered.length}건</span>
        <LimitSelect limit={limit} onLimitChange={(n) => { setLimit(n); setPage(1); }} />
      </div>

      {/* 삭제 항목 — 표 + 모바일 카드 */}
      <div className="bg-background border border-border rounded-[var(--radius-lg)] shadow-[var(--shadow-sm)] overflow-hidden">
        <div className="table-wrap max-md:hidden">
          <table>
            <colgroup>
              <col style={{ width: '64px' }} />
              <col />
              <col style={{ width: '120px' }} />
              <col style={{ width: '120px' }} />
              <col style={{ width: '100px' }} />
              <col style={{ width: '170px' }} />
            </colgroup>
            <thead>
              <tr>
                <th>번호</th><th>이름</th><th>유형</th><th>삭제일</th><th>남은 기간</th><th>관리</th>
              </tr>
            </thead>
            <tbody>
              {paged.length === 0 && (
                <tr><td colSpan={6} className="td-center td-muted">휴지통이 비어 있습니다.</td></tr>
              )}
              {paged.map((it, i) => (
                <tr key={`${it.kind}-${it.id}`}>
                  <td className="td-center td-muted">{filtered.length - (page - 1) * limit - i}</td>
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
              <div className="flex justify-between items-baseline gap-2.5">
                <span className="font-semibold text-[0.95rem] break-all">{it.name}</span>
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

        <Pagination page={page} totalPages={totalPages} totalItems={filtered.length} onPageChange={setPage} />
      </div>
      {confirmElement}
    </AppShell>
  );
}
