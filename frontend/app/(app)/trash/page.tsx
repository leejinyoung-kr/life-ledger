'use client';

/**
 * 휴지통 페이지.
 * 모든 도메인의 삭제(soft-delete) 항목을 모아 복구/영구삭제한다. (30일 경과 시 자동 영구 삭제)
 * 데이터는 백엔드 API(/trash)와 연동한다.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import AppShell from '@/components/AppShell';
import { IconAlertCircle, IconSearch } from '@/components/icons';
import { api } from '@/lib/api';
import { trashDate, type TrashItem } from '@/lib/trash';

export default function TrashPage() {
  const [items, setItems] = useState<TrashItem[]>([]);
  const [query, setQuery] = useState('');
  const [type, setType] = useState('전체 유형');
  const [error, setError] = useState<string | null>(null);

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
      load();
    } catch (e) { setError((e as Error).message); }
  }

  // 단일 영구 삭제
  async function purge(it: TrashItem) {
    if (!window.confirm(`'${it.name}'을(를) 영구 삭제할까요? 되돌릴 수 없습니다.`)) return;
    try {
      await api.post('/trash/purge', { kind: it.kind, id: it.id });
      load();
    } catch (e) { setError((e as Error).message); }
  }

  // 전체 복구
  async function restoreAll() {
    if (items.length === 0 || !window.confirm('모든 삭제 항목을 복구할까요?')) return;
    try {
      await api.post('/trash/restore-all', {});
      load();
    } catch (e) { setError((e as Error).message); }
  }

  // 휴지통 비우기 (전체 영구 삭제)
  async function emptyTrash() {
    if (items.length === 0 || !window.confirm('휴지통을 비울까요? 모든 항목이 영구 삭제됩니다.')) return;
    try {
      await api.post('/trash/empty', {});
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

  return (
    <AppShell activePath="/trash" topbarLabel="휴지통">
      <div className="page-header">
        <h1 className="page-title">휴지통</h1>
        <p className="page-subtitle">삭제한 항목은 30일간 보관 후 자동으로 영구 삭제됩니다.</p>
      </div>

      <div className="info-bar">
        <IconAlertCircle width={16} height={16} />
        모든 보관함(가계부·예적금·투자·구독·자산·할일·목표·메모·일정)의 삭제 항목이 모입니다. 30일 경과 시 복구 불가.
      </div>

      {error && <p className="ledger-note is-error">⚠️ {error}</p>}

      {/* 검색 / 유형 필터 / 일괄 액션 */}
      <div className="toolbar">
        <div className="search-wrap">
          <IconSearch className="search-icon" />
          <input className="input" type="text" placeholder="삭제 항목 검색..." value={query} onChange={(e) => setQuery(e.target.value)} aria-label="삭제 항목 검색" />
        </div>
        <select className="input filter-select" value={type} onChange={(e) => setType(e.target.value)} aria-label="유형 필터">
          {types.map((t) => <option key={t}>{t}</option>)}
        </select>
        <div className="toolbar-right">
          <button type="button" className="btn btn-ghost" onClick={restoreAll}>전체 복구</button>
          <button type="button" className="btn btn-danger" onClick={emptyTrash}>휴지통 비우기</button>
        </div>
      </div>

      {/* 삭제 항목 테이블 */}
      <div className="card flush">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>이름</th><th>유형</th><th>삭제일</th><th>남은 기간</th><th className="td-center">액션</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={5} className="td-center td-muted">휴지통이 비어 있습니다.</td></tr>
              )}
              {filtered.map((it) => (
                <tr key={`${it.kind}-${it.id}`}>
                  <td className="td-strong">{it.name}</td>
                  <td><span className="type-chip">{it.chip}</span></td>
                  <td className="td-muted">{trashDate(it.deletedAt)}</td>
                  <td className={`trash-left${it.daysLeft <= 2 ? ' soon' : ''}`}>{it.daysLeft}일</td>
                  <td className="td-center">
                    <div className="trash-actions">
                      <button type="button" className="btn btn-ghost" onClick={() => restore(it)}>복구</button>
                      <button type="button" className="btn btn-danger" onClick={() => purge(it)}>영구삭제</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
