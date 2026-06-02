'use client';

/**
 * 휴지통 페이지.
 * 모든 보관함의 삭제 항목을 모아 복구/영구삭제한다. (30일 경과 시 자동 영구 삭제)
 * 공통 레이아웃(AppShell)을 재사용하고 데이터는 더미로 채운다.
 */
import { useState } from 'react';
import AppShell from '@/components/AppShell';
import { IconAlertCircle, IconSearch } from '@/components/icons';

interface TrashItem { id: number; name: string; chip: string; type: string; deleted: string; daysLeft: number; }

// ── 더미 데이터 (TODO: GET /api/v1/trash) ───────────────────────
const INITIAL: TrashItem[] = [
  { id: 1, name: '스타벅스 -₩6,500', chip: '💰 가계부', type: '가계부', deleted: '2025.05.31', daysLeft: 29 },
  { id: 2, name: '트위터 계정', chip: '🔑 계정', type: '계정', deleted: '2025.05.28', daysLeft: 26 },
  { id: 3, name: 'old-project (.env 12개)', chip: '⌥ ENV', type: 'ENV', deleted: '2025.05.20', daysLeft: 18 },
  { id: 4, name: '계약서_2023.pdf', chip: '📄 파일', type: '파일', deleted: '2025.05.10', daysLeft: 8 },
  { id: 5, name: '회의 메모 (4월)', chip: '📝 메모', type: '메모', deleted: '2025.05.04', daysLeft: 2 },
  { id: 6, name: '구 운전면허증', chip: '🪪 신원지갑', type: '신원지갑', deleted: '2025.05.03', daysLeft: 1 },
];

const TYPES = ['전체 유형', '가계부', '계정', 'ENV', '파일', '메모'];

export default function TrashPage() {
  const [items, setItems] = useState<TrashItem[]>(INITIAL);
  const [query, setQuery] = useState('');
  const [type, setType] = useState('전체 유형');

  // 단일 항목 복구. TODO: POST /api/v1/trash/:id/restore
  function restore(id: number) {
    setItems((prev) => prev.filter((it) => it.id !== id));
  }

  // 단일 항목 영구 삭제. TODO: DELETE /api/v1/trash/:id
  function purge(id: number) {
    setItems((prev) => prev.filter((it) => it.id !== id));
  }

  // 전체 복구 / 휴지통 비우기. TODO: API 연동
  function restoreAll() { setItems([]); }
  function emptyTrash() { setItems([]); }

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
        모든 보관함(가계부·계정·ENV·파일·메모·신원지갑)의 삭제 항목이 모입니다. 30일 경과 시 복구 불가.
      </div>

      {/* 검색 / 유형 필터 / 일괄 액션 */}
      <div className="toolbar">
        <div className="search-wrap">
          <IconSearch className="search-icon" />
          <input className="input" type="text" placeholder="삭제 항목 검색..." value={query} onChange={(e) => setQuery(e.target.value)} aria-label="삭제 항목 검색" />
        </div>
        <select className="input filter-select" value={type} onChange={(e) => setType(e.target.value)} aria-label="유형 필터">
          {TYPES.map((t) => <option key={t}>{t}</option>)}
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
              {filtered.map((it) => (
                <tr key={it.id}>
                  <td className="td-strong">{it.name}</td>
                  <td><span className="type-chip">{it.chip}</span></td>
                  <td className="td-muted">{it.deleted}</td>
                  <td className={`trash-left${it.daysLeft <= 2 ? ' soon' : ''}`}>{it.daysLeft}일</td>
                  <td className="td-center">
                    <div className="trash-actions">
                      <button type="button" className="btn btn-ghost" onClick={() => restore(it.id)}>복구</button>
                      <button type="button" className="btn btn-danger" onClick={() => purge(it.id)}>영구삭제</button>
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
