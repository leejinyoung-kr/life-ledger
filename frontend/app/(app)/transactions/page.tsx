'use client';

/**
 * 가계부 페이지.
 * 수입/지출 · 예적금 · 투자 3개 탭을 한 화면에서 관리한다.
 * 데이터는 백엔드 API(/transactions, /savings, /investments)와 실시간 연동한다.
 */
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import AppShell from '@/components/AppShell';
import Modal from '@/components/Modal';
import StatCard from '@/components/StatCard';
import {
  IconWon, IconBank, IconTrendUp, IconDownload, IconFileBlank, IconUpload,
  IconSearch, IconEdit, IconTrash, IconChart, IconAlertTriangle,
} from '@/components/icons';

import { toast } from 'sonner';
import { useConfirm } from '@/components/ConfirmModal';
import Pagination, { LimitSelect } from '@/components/Pagination';
import { api } from '@/lib/api';
import { downloadTransactionTemplate } from '@/lib/excel';
import {
  CATEGORY_LABEL, PAY_METHODS, SAVING_TYPE_LABEL, INVEST_TYPE_LABEL,
  TX_TYPE_LABEL, CYCLE_LABEL, WEEKEND_ADJUST_LABEL, won, signedWon, dotDate, daysUntil,
  type Category, type Transaction, type TransactionSummary, type TrendBucket,
  type Saving, type SavingSummary, type SavingType,
  type Investment, type InvestmentSummary, type InvestmentType, type TransactionType,
  type RecurringCycle, type WeekendAdjust,
} from '@/lib/finance';

type TabId = 'ledger' | 'savings' | 'invest';

const ADD_LABELS: Record<TabId, string> = {
  ledger: '항목 추가',
  savings: '예적금 추가',
  invest: '투자 항목 추가',
};

export default function TransactionsPage() {
  const [tab, setTab] = useState<TabId>('ledger');
  const [reload, setReload] = useState({ ledger: 0, savings: 0, invest: 0 });
  const bump = (k: TabId) => setReload((s) => ({ ...s, [k]: s[k] + 1 }));

  const [ledgerModal, setLedgerModal] = useState<{ open: boolean; mode: 'add' | 'edit'; editing?: Transaction }>({ open: false, mode: 'add' });
  const [savingsModal, setSavingsModal] = useState<{ open: boolean; mode: 'add' | 'edit'; editing?: Saving }>({ open: false, mode: 'add' });
  const [investModal, setInvestModal] = useState<{ open: boolean; mode: 'add' | 'edit'; editing?: Investment }>({ open: false, mode: 'add' });

  // 도메인별 카테고리 — 마운트 시 한 번만 조회
  const [txCats, setTxCats] = useState<Category[]>([]);
  const [savingCats, setSavingCats] = useState<Category[]>([]);
  const [investCats, setInvestCats] = useState<Category[]>([]);

  useEffect(() => {
    Promise.all([
      api.get<Category[]>('/categories?domain=transaction'),
      api.get<Category[]>('/categories?domain=saving'),
      api.get<Category[]>('/categories?domain=investment'),
    ]).then(([tx, sav, inv]) => {
      setTxCats(tx.filter((c) => c.isActive));
      setSavingCats(sav.filter((c) => c.isActive));
      setInvestCats(inv.filter((c) => c.isActive));
    });
  }, []);

  function openAddModal() {
    if (tab === 'ledger') setLedgerModal({ open: true, mode: 'add' });
    if (tab === 'savings') setSavingsModal({ open: true, mode: 'add' });
    if (tab === 'invest') setInvestModal({ open: true, mode: 'add' });
  }

  return (
    <AppShell activePath="/transactions" topbarLabel="가계부">
      <div className="page-header">
        <div>
          <h1 className="page-title">가계부</h1>
          <p className="page-subtitle">수입/지출, 예적금, 투자를 한 곳에서 관리하세요.</p>
        </div>
      </div>

      <div className="page-tabs">
        <Tab active={tab === 'ledger'} onClick={() => setTab('ledger')} icon={<IconWon />}>수입 / 지출</Tab>
        <Tab active={tab === 'savings'} onClick={() => setTab('savings')} icon={<IconBank />}>예적금</Tab>
        <Tab active={tab === 'invest'} onClick={() => setTab('invest')} icon={<IconTrendUp />}>투자</Tab>
        <div style={{ flex: 1 }} />
        <button type="button" className="btn btn-primary tabs-add-btn" onClick={openAddModal}>
          {ADD_LABELS[tab]}
        </button>
      </div>

      {tab === 'ledger' && (
        <LedgerTab
          reloadKey={reload.ledger}
          categories={txCats}
          onEdit={(tx) => setLedgerModal({ open: true, mode: 'edit', editing: tx })}
          onDeleted={() => bump('ledger')}
        />
      )}
      {tab === 'savings' && (
        <SavingsTab
          reloadKey={reload.savings}
          savingCats={savingCats}
          onAdd={() => setSavingsModal({ open: true, mode: 'add' })}
          onEdit={(s) => setSavingsModal({ open: true, mode: 'edit', editing: s })}
          onDeleted={() => bump('savings')}
        />
      )}
      {tab === 'invest' && (
        <InvestTab
          reloadKey={reload.invest}
          investCats={investCats}
          onAdd={() => setInvestModal({ open: true, mode: 'add' })}
          onEdit={(v) => setInvestModal({ open: true, mode: 'edit', editing: v })}
          onDeleted={() => bump('invest')}
        />
      )}

      <LedgerModal
        state={ledgerModal}
        categories={txCats}
        onClose={() => setLedgerModal((s) => ({ ...s, open: false }))}
        onSaved={() => { setLedgerModal((s) => ({ ...s, open: false })); bump('ledger'); }}
      />
      <SavingsModal
        state={savingsModal}
        onClose={() => setSavingsModal((s) => ({ ...s, open: false }))}
        onSaved={() => { setSavingsModal((s) => ({ ...s, open: false })); bump('savings'); }}
      />
      <InvestModal
        state={investModal}
        onClose={() => setInvestModal((s) => ({ ...s, open: false }))}
        onSaved={() => { setInvestModal((s) => ({ ...s, open: false })); bump('invest'); }}
      />
    </AppShell>
  );
}

function Tab({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: ReactNode; children: ReactNode }) {
  return (
    <button type="button" className={`page-tab${active ? ' active' : ''}`} onClick={onClick}>
      {icon}{children}
    </button>
  );
}

// 오늘 날짜 YYYY-MM-DD
function toDay(): string { return new Date().toISOString().slice(0, 10); }
// N달 전 날짜 YYYY-MM-DD
function monthsAgo(n: number): string {
  const d = new Date(); d.setMonth(d.getMonth() - n); return d.toISOString().slice(0, 10);
}

// ── 탭 1: 수입 / 지출 ───────────────────────────────────────────
function LedgerTab({ reloadKey, categories, onEdit, onDeleted }: { reloadKey: number; categories: Category[]; onEdit: (tx: Transaction) => void; onDeleted: () => void }) {
  // 입력 중인 (미적용) 필터
  const [pendingFrom, setPendingFrom] = useState(() => monthsAgo(1));
  const [pendingTo, setPendingTo] = useState(toDay);
  const [pendingType, setPendingType] = useState('');
  const [pendingCat, setPendingCat] = useState('');
  const [pendingQ, setPendingQ] = useState('');

  // 조회 버튼 클릭 시 적용되는 필터
  const [applied, setApplied] = useState(() => ({
    from: monthsAgo(1), to: toDay(), type: '', cat: '', q: '',
  }));

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const { confirm, confirmElement } = useConfirm();

  const [rows, setRows] = useState<Transaction[]>([]);
  const [summary, setSummary] = useState<TransactionSummary | null>(null);
  const [trend, setTrend] = useState<TrendBucket[]>([]);
  const [recurring, setRecurring] = useState<Transaction[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [activePreset, setActivePreset] = useState<number | null>(1); // 초기: 1개월 활성

  // categories 배열 → code:label 룩업맵
  const catMap = Object.fromEntries(categories.map((c) => [c.code, c.label]));

  // pending → applied
  function search() { setApplied({ from: pendingFrom, to: pendingTo, type: pendingType, cat: pendingCat, q: pendingQ }); setPage(1); }

  // 필터 초기화 + 즉시 적용
  function reset() {
    const from = monthsAgo(1); const to = toDay();
    setPendingFrom(from); setPendingTo(to);
    setPendingType(''); setPendingCat(''); setPendingQ('');
    setApplied({ from, to, type: '', cat: '', q: '' });
    setActivePreset(1);
    setPage(1);
  }

  // 프리셋 버튼: 입력값만 변경 + 해당 버튼 활성화
  function applyPreset(months: number) {
    const from = monthsAgo(months); const to = toDay();
    setPendingFrom(from); setPendingTo(to);
    setActivePreset(months);
  }

  // 내역 목록 조회 (applied 필터 기준)
  const loadRows = useCallback(async () => {
    const params = new URLSearchParams();
    if (applied.from) params.set('from', applied.from);
    if (applied.to) params.set('to', applied.to);
    if (applied.type) params.set('type', applied.type);
    if (applied.cat) params.set('category', applied.cat);
    if (applied.q) params.set('q', applied.q);
    try {
      setRows(await api.get<Transaction[]>(`/transactions?${params.toString()}`));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [applied]);

  // 요약/추이/반복거래 조회 (applied.to 기준 월)
  const loadAside = useCallback(async () => {
    const month = applied.to.slice(0, 7);
    try {
      const [s, t, r] = await Promise.all([
        api.get<TransactionSummary>(`/transactions/summary?month=${month}`),
        api.get<TrendBucket[]>(`/transactions/monthly-trend?month=${month}`),
        api.get<Transaction[]>('/transactions/recurring'),
      ]);
      setSummary(s); setTrend(t); setRecurring(r);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [applied.to]);

  useEffect(() => { loadRows(); }, [loadRows, reloadKey]);
  useEffect(() => { loadAside(); }, [loadAside, reloadKey]);

  // 내역 삭제
  async function remove(id: number) {
    if (!await confirm('이 내역을 삭제할까요?', 'danger')) return;
    try {
      await api.del(`/transactions/${id}`);
      toast.success('내역이 삭제됐습니다.');
      onDeleted();
    } catch {
      toast.error('삭제에 실패했습니다.');
    }
  }

  // 활성 카테고리 라벨로 빈 엑셀 양식 다운로드
  async function downloadTemplate() {
    try {
      await downloadTransactionTemplate(categories.map((c) => c.label));
    } catch {
      toast.error('양식 생성에 실패했습니다.');
    }
  }

  // 엑셀 양식 업로드 → 백엔드 일괄 등록 후 결과 토스트 + 목록 갱신
  async function handleUpload(ev: React.ChangeEvent<HTMLInputElement>) {
    const file = ev.target.files?.[0];
    ev.target.value = ''; // 같은 파일 재선택 가능하도록 초기화
    if (!file) return;
    try {
      const res = await api.upload<{ imported: number; failed: number; errors: { row: number; message: string }[] }>(
        '/transactions/import', file,
      );
      if (res.failed > 0) {
        toast.warning(`${res.imported}건 추가 · ${res.failed}건 실패 (${res.errors.slice(0, 3).map((e) => `${e.row}행`).join(', ')}…)`);
      } else {
        toast.success(`${res.imported}건이 추가됐습니다.`);
      }
      onDeleted(); // reloadKey bump → 목록·요약 재조회
    } catch (err) {
      toast.error((err as Error).message || '업로드에 실패했습니다.');
    }
  }

  // 현재 적용 필터 그대로 백엔드 export 엔드포인트로 xlsx 다운로드
  async function downloadData() {
    const params = new URLSearchParams();
    if (applied.from) params.set('from', applied.from);
    if (applied.to) params.set('to', applied.to);
    if (applied.type) params.set('type', applied.type);
    if (applied.cat) params.set('category', applied.cat);
    if (applied.q) params.set('q', applied.q);
    try {
      await api.download(`/transactions/export?${params.toString()}`, '가계부.xlsx');
    } catch (err) {
      toast.error((err as Error).message || '다운로드에 실패했습니다.');
    }
  }

  const maxTrend = Math.max(1, ...trend.map((b) => b.total));
  const totalPages = Math.ceil(rows.length / limit);
  const pagedRows = rows.slice((page - 1) * limit, page * limit);

  return (
    <>
      {error && <p className="ledger-note is-error">⚠️ {error}</p>}

      {summary && (
        <div className="grid-4 mb-6">
          <StatCard icon={<IconWon />} tone="green" value={won(summary.income)} label="수입" change="이번 달 합계" changeDir="up" />
          <StatCard icon={<IconWon />} tone="red" value={won(summary.expense)} label="지출" change="이번 달 합계" changeDir="down" />
          <StatCard icon={<IconBank />} tone="amber" value={won(summary.realSpend)} label="실소비" change={`저축이동 ${won(summary.transfer)}`} changeDir="neutral" />
          <StatCard icon={<IconChart />} tone="blue" value={won(summary.balance)} label="잔액" change="수입 − 실소비" changeDir="neutral" />
        </div>
      )}

      <p className="ledger-note mb-6">
        💡 <strong>자산이동</strong>은 실소비가 아닌 자산 이동으로 잔액 계산에서 제외됩니다.
      </p>

      <div className="grid-2 mb-6">
        <div className="card">
          <div className="card-header"><span className="card-title">월별 지출 추이</span></div>
          <div className="card-body">
            <div className="bars">
              {trend.map((b) => {
                const isCurrent = b.month === applied.to.slice(0, 7);
                return (
                  <div key={b.month} className={`bar${isCurrent ? ' current' : ''}`} style={{ height: `${Math.round((b.total / maxTrend) * 100)}%` }}>
                    <span>{isCurrent ? won(b.total) : ''}</span>
                    <small>{b.label}</small>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        <div className="card">
          <div className="card-header">
            <span className="card-title">🔁 반복 거래</span>
            <span className="badge badge-neutral">자동 등록</span>
          </div>
          <div className="card-body compact">
            <div className="recur-list">
              {recurring.length === 0 && <div className="recur-sub">반복 거래가 없습니다.</div>}
              {recurring.map((r) => (
                <div className="recur-item" key={r.id}>
                  <div className="recur-title">{r.title} — {won(r.amount)}</div>
                  <div className="recur-sub">
                    {CATEGORY_LABEL[r.category] ?? r.category} · {TX_TYPE_LABEL[r.type]}
                    {r.recurringRule && (
                      <> · {CYCLE_LABEL[r.recurringRule.cycle]} {r.recurringRule.day}일
                      {r.recurringRule.weekendAdjust !== 'none' && ` · 주말→${WEEKEND_ADJUST_LABEL[r.recurringRule.weekendAdjust]}`}
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 엑셀 툴바 — TODO: 다운로드/업로드 API 연동 (Phase 4-5) */}
      <div className="excel-toolbar">
        <span className="excel-toolbar-label">엑셀</span>
        <button type="button" className="excel-btn" onClick={downloadTemplate}><IconFileBlank />양식 다운로드</button>
        <label className="excel-btn upload">
          <IconUpload />엑셀 업로드
          <input type="file" accept=".xlsx,.xls,.csv" hidden aria-label="엑셀 업로드" onChange={handleUpload} />
        </label>
        <div className="divider-v" />
        <button type="button" className="excel-btn" onClick={downloadData}><IconDownload />데이터 다운로드</button>
      </div>

      <div className="search-panel">
        <div className="search-panel-row">
          <input type="date" className="input filter-date" value={pendingFrom} onChange={(ev) => { setPendingFrom(ev.target.value); setActivePreset(null); }} aria-label="조회 시작일" />
          <span className="filter-date-sep">~</span>
          <input type="date" className="input filter-date" value={pendingTo} onChange={(ev) => { setPendingTo(ev.target.value); setActivePreset(null); }} aria-label="조회 종료일" />
          <div className="preset-btns">
            <button type="button" className={`btn btn-sm ${activePreset === 1 ? 'btn-primary' : 'btn-ghost'}`} onClick={() => applyPreset(1)}>1개월</button>
            <button type="button" className={`btn btn-sm ${activePreset === 2 ? 'btn-primary' : 'btn-ghost'}`} onClick={() => applyPreset(2)}>2개월</button>
            <button type="button" className={`btn btn-sm ${activePreset === 3 ? 'btn-primary' : 'btn-ghost'}`} onClick={() => applyPreset(3)}>3개월</button>
          </div>
        </div>
        <div className="search-panel-row">
          <select className="input filter-select" value={pendingType} onChange={(ev) => setPendingType(ev.target.value)} aria-label="유형 필터">
            <option value="">전체 유형</option>
            <option value="income">수입</option><option value="expense">지출</option><option value="transfer">자산이동</option>
          </select>
          <select className="input filter-select" value={pendingCat} onChange={(ev) => setPendingCat(ev.target.value)} aria-label="카테고리 필터">
            <option value="">전체 카테고리</option>
            {categories.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
          </select>
          <div className="search-wrap filter-search">
            <IconSearch className="search-icon" />
            <input className="input" type="text" placeholder="내역 검색..." value={pendingQ} onChange={(ev) => setPendingQ(ev.target.value)} aria-label="내역 검색" />
          </div>
          <button type="button" className="btn btn-primary" onClick={search}>조회</button>
          <button type="button" className="btn btn-ghost" onClick={reset}>초기화</button>
        </div>
      </div>

      <div className="table-bar">
        <span className="table-count">총 {rows.length}건</span>
        <LimitSelect limit={limit} onLimitChange={(n) => { setLimit(n); setPage(1); }} />
      </div>

      <div className="card flush">
        <div className="table-wrap">
          <table>
            <colgroup>
              <col style={{ width: '64px' }} />
              <col style={{ width: '88px' }} />
              <col style={{ width: '100px' }} />
              <col />
              <col style={{ width: '112px' }} />
              <col style={{ width: '132px' }} />
              <col style={{ width: '200px' }} />
              <col style={{ width: '96px' }} />
              <col style={{ width: '72px' }} />
            </colgroup>
            <thead>
              <tr>
                <th>번호</th><th>유형</th><th>카테고리</th><th>내역</th>
                <th>결제수단</th><th>금액</th><th>메모</th>
                <th>날짜</th><th>관리</th>
              </tr>
            </thead>
            <tbody>
              {pagedRows.length === 0 && (
                <tr><td colSpan={9} className="td-center td-muted">내역이 없습니다.</td></tr>
              )}
              {pagedRows.map((row, i) => (
                <tr key={row.id}>
                  <td className="td-center td-muted">{rows.length - (page - 1) * limit - i}</td>
                  <td className="td-center"><span className={`type-badge ${row.type}`}>{TX_TYPE_LABEL[row.type]}</span></td>
                  <td className="td-center"><span className="cat-chip">{catMap[row.category] ?? row.category}</span></td>
                  <td className="td-name">{row.title}</td>
                  <td className="td-center td-muted">{row.payMethod}</td>
                  <td className={`td-right amount-${row.type}`}>{signedWon(row.type, row.amount)}</td>
                  <td className="td-center td-muted">{row.memo ?? '-'}</td>
                  <td className="td-center td-muted">{dotDate(row.date)}</td>
                  <td className="td-center"><RowActions onEdit={() => onEdit(row)} onDelete={() => remove(row.id)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={page} totalPages={totalPages} totalItems={rows.length} onPageChange={setPage} />
      </div>
      {confirmElement}
    </>
  );
}

// ── 탭 2: 예적금 ───────────────────────────────────────────────
function SavingsTab({ reloadKey, savingCats, onAdd, onEdit, onDeleted }: { reloadKey: number; savingCats: Category[]; onAdd: () => void; onEdit: (s: Saving) => void; onDeleted: () => void }) {
  const [rows, setRows] = useState<Saving[]>([]);
  const [summary, setSummary] = useState<SavingSummary | null>(null);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const { confirm, confirmElement } = useConfirm();

  // 필터 입력 (pending) + 적용 (applied) — 은행 검색 제거
  const [pendingType, setPendingType] = useState('');
  const [pendingName, setPendingName] = useState('');
  const [applied, setApplied] = useState({ type: '', name: '' });

  function search() { setApplied({ type: pendingType, name: pendingName }); setPage(1); }
  function reset() { setPendingType(''); setPendingName(''); setApplied({ type: '', name: '' }); setPage(1); }

  useEffect(() => {
    (async () => {
      const [list, s] = await Promise.all([
        api.get<Saving[]>('/savings'),
        api.get<SavingSummary>('/savings/summary'),
      ]);
      setRows(list); setSummary(s);
    })();
  }, [reloadKey]);

  async function remove(id: number) {
    if (!await confirm('이 예적금을 삭제할까요?', 'danger')) return;
    try {
      await api.del(`/savings/${id}`);
      toast.success('예적금이 삭제됐습니다.');
      onDeleted();
    } catch {
      toast.error('삭제에 실패했습니다.');
    }
  }


  return (
    <>
      {summary && (
        <div className="grid-4 mb-6">
          <StatCard icon={<IconBank />} tone="green" value={won(summary.totalBalance)} label="총 예적금" change="전체 잔액 합계" changeDir="neutral" />
          <StatCard icon={<IconWon />} tone="blue" value={won(summary.monthlyDeposit)} label="이번 달 납입" change="월 납입액 합계" changeDir="neutral" />
          <StatCard icon={<IconTrendUp />} tone="amber" value={`${summary.avgRate}%`} label="평균 금리" change="보유 상품 평균" changeDir="up" />
          <StatCard icon={<IconAlertTriangle />} tone={summary.maturityNear > 0 ? 'red' : 'green'} value={`${summary.maturityNear}건`} label="만기 임박" change={summary.maturityNear > 0 ? '30일 이내 만기' : '이상 없음'} changeDir={summary.maturityNear > 0 ? 'down' : 'neutral'} />
        </div>
      )}

      <div className="search-panel">
        <div className="search-panel-row">
          <select className="input filter-select" value={pendingType} onChange={(ev) => setPendingType(ev.target.value)} aria-label="유형 필터">
            <option value="">전체 유형</option>
            {savingCats.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
          </select>
          <div className="search-wrap filter-search">
            <IconSearch className="search-icon" />
            <input className="input" type="text" placeholder="상품명 검색..." value={pendingName} onChange={(ev) => setPendingName(ev.target.value)} aria-label="상품명 검색" />
          </div>
          <button type="button" className="btn btn-primary" onClick={search}>조회</button>
          <button type="button" className="btn btn-ghost" onClick={reset}>초기화</button>
        </div>
      </div>

      {(() => {
        const filtered = rows
          .filter((c) => !applied.type || c.type === applied.type)
          .filter((c) => !applied.name || c.name.includes(applied.name));
        const totalPages = Math.ceil(filtered.length / limit);
        const paged = filtered.slice((page - 1) * limit, page * limit);
        return (<>
      <div className="table-bar">
        <span className="table-count">총 {filtered.length}건</span>
        <LimitSelect limit={limit} onLimitChange={(n) => { setLimit(n); setPage(1); }} />
      </div>
      <div className="card flush mb-4">
        <div className="table-wrap">
          <table>
            <colgroup>
              <col style={{ width: '64px' }} />
              <col style={{ width: '88px' }} />
              <col style={{ width: '140px' }} />
              <col />
              <col style={{ width: '120px' }} />
              <col style={{ width: '110px' }} />
              <col style={{ width: '80px' }} />
              <col style={{ width: '110px' }} />
              <col style={{ width: '150px' }} />
              <col style={{ width: '72px' }} />
            </colgroup>
            <thead>
              <tr>
                <th>번호</th><th>유형</th><th>은행/기관</th><th>상품명</th>
                <th>잔액</th><th>월 납입</th>
                <th>금리</th><th>가입일</th><th>만기일</th>
                <th>관리</th>
              </tr>
            </thead>
            <tbody>
              {paged.length === 0 && (
                <tr><td colSpan={10} className="td-center td-muted">예적금 내역이 없습니다.</td></tr>
              )}
              {paged.map((c, i) => {
                const dleft = daysUntil(c.maturityDate);
                const near = dleft !== null && dleft >= 0 && dleft <= 30;
                return (
                  <tr key={c.id}>
                    <td className="td-center td-muted">{filtered.length - (page - 1) * limit - i}</td>
                    <td className="td-center"><span className={`savings-type-badge ${c.type === 'deposit' ? 'badge-deposit' : 'badge-savings'}`}>{SAVING_TYPE_LABEL[c.type]}</span></td>
                    <td className="td-center td-muted">{c.bank}</td>
                    <td className="td-name">{c.name}</td>
                    <td className="td-mono td-right">{won(c.balance)}</td>
                    <td className="td-mono td-right">{c.monthlyAmount > 0 ? won(c.monthlyAmount) : '-'}</td>
                    <td className="td-right"><span className="savings-meta-value accent">{c.interestRate}%</span></td>
                    <td className="td-center td-muted">{dotDate(c.startDate)}</td>
                    <td className={`td-center ${near ? 'savings-meta-value warning' : 'td-muted'}`}>
                      {c.maturityDate ? `${dotDate(c.maturityDate)}${near ? ` ⚠️ D-${dleft}` : ''}` : '-'}
                    </td>
                    <td className="td-center"><RowActions onEdit={() => onEdit(c)} onDelete={() => remove(c.id)} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <Pagination page={page} totalPages={totalPages} totalItems={filtered.length} onPageChange={setPage} />
      </div>
        </>);
      })()}
      {confirmElement}
    </>
  );
}

// ── 탭 3: 투자 ─────────────────────────────────────────────────
function InvestTab({ reloadKey, investCats, onAdd, onEdit, onDeleted }: { reloadKey: number; investCats: Category[]; onAdd: () => void; onEdit: (v: Investment) => void; onDeleted: () => void }) {
  const [rows, setRows] = useState<Investment[]>([]);
  const [summary, setSummary] = useState<InvestmentSummary | null>(null);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  // 필터 입력 (pending) + 적용 (applied) — 메모 검색 제거
  const [pendingName, setPendingName] = useState('');
  const [pendingType, setPendingType] = useState('');
  const [applied, setApplied] = useState({ name: '', type: '' });

  function search() { setApplied({ name: pendingName, type: pendingType }); setPage(1); }
  function reset() { setPendingName(''); setPendingType(''); setApplied({ name: '', type: '' }); setPage(1); }
  const { confirm, confirmElement } = useConfirm();

  useEffect(() => {
    (async () => {
      const [list, s] = await Promise.all([
        api.get<Investment[]>('/investments'),
        api.get<InvestmentSummary>('/investments/summary'),
      ]);
      setRows(list); setSummary(s);
    })();
  }, [reloadKey]);

  async function remove(id: number) {
    if (!await confirm('이 투자 항목을 삭제할까요?', 'danger')) return;
    try {
      await api.del(`/investments/${id}`);
      toast.success('투자 항목이 삭제됐습니다.');
      onDeleted();
    } catch {
      toast.error('삭제에 실패했습니다.');
    }
  }

  const profitUp = (summary?.totalProfit ?? 0) >= 0;

  return (
    <>
      {summary && (
        <div className="grid-3 mb-6">
          <StatCard icon={<IconTrendUp />} tone="blue" value={won(summary.totalValue)} label="총 평가금액" change={`원금 대비 ${profitUp ? '+' : ''}${summary.profitRate}%`} changeDir={profitUp ? 'up' : 'down'} />
          <StatCard icon={<IconWon />} tone="amber" value={won(summary.totalPrincipal)} label="총 투자원금" change="투자 원금 합계" changeDir="neutral" />
          <StatCard icon={<IconChart />} tone={profitUp ? 'green' : 'red'} value={`${profitUp ? '+' : '-'}${won(summary.totalProfit)}`} label="총 수익" change={`수익률 ${profitUp ? '+' : ''}${summary.profitRate}%`} changeDir={profitUp ? 'up' : 'down'} />
        </div>
      )}

      <div className="search-panel">
        <div className="search-panel-row">
          <select className="input filter-select" value={pendingType} onChange={(ev) => setPendingType(ev.target.value)} aria-label="유형 필터">
            <option value="">전체 유형</option>
            {investCats.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
          </select>
          <div className="search-wrap filter-search">
            <IconSearch className="search-icon" />
            <input className="input" type="text" placeholder="종목명 검색..." value={pendingName} onChange={(ev) => setPendingName(ev.target.value)} aria-label="종목명 검색" />
          </div>
          <button type="button" className="btn btn-primary" onClick={search}>조회</button>
          <button type="button" className="btn btn-ghost" onClick={reset}>초기화</button>
        </div>
      </div>

      {(() => {
        const filtered = rows
          .filter((r) => !applied.type || r.type === applied.type)
          .filter((r) => !applied.name || r.name.includes(applied.name));
        const totalPages = Math.ceil(filtered.length / limit);
        const paged = filtered.slice((page - 1) * limit, page * limit);
        return (<>
      <div className="table-bar">
        <span className="table-count">총 {filtered.length}건</span>
        <LimitSelect limit={limit} onLimitChange={(n) => { setLimit(n); setPage(1); }} />
      </div>
      <div className="card flush mb-6">
        <div className="table-wrap">
          <table>
            <colgroup>
              <col style={{ width: '64px' }} />
              <col style={{ width: '96px' }} />
              <col />
              <col style={{ width: '120px' }} />
              <col style={{ width: '120px' }} />
              <col style={{ width: '120px' }} />
              <col style={{ width: '96px' }} />
              <col style={{ width: '180px' }} />
              <col style={{ width: '72px' }} />
            </colgroup>
            <thead>
              <tr>
                <th>번호</th><th>유형</th><th>종목</th>
                <th>투자원금</th><th>평가금액</th>
                <th>수익</th><th>수익률</th>
                <th>메모</th><th>관리</th>
              </tr>
            </thead>
            <tbody>
              {paged.length === 0 && (
                <tr><td colSpan={9} className="td-center td-muted">투자 항목이 없습니다.</td></tr>
              )}
              {paged.map((row, i) => {
                    const up = row.profit >= 0;
                    return (
                      <tr key={row.id}>
                        <td className="td-center td-muted">{filtered.length - (page - 1) * limit - i}</td>
                        <td className="td-center"><span className="cat-chip">{INVEST_TYPE_LABEL[row.type]}</span></td>
                        <td className="td-strong">{row.name}</td>
                        <td className="td-mono td-right">{won(row.principal)}</td>
                        <td className="td-mono td-right">{won(row.currentValue)}</td>
                        <td className={`td-right amount-${up ? 'income' : 'expense'}`}>{up ? '+' : '-'}{won(row.profit)}</td>
                        <td className="td-center"><span className={`return-pill ${up ? 'up' : 'down'}`}>{up ? '+' : ''}{row.profitRate}%</span></td>
                        <td className="td-center td-muted">{row.memo ?? '-'}</td>
                        <td className="td-center"><RowActions onEdit={() => onEdit(row)} onDelete={() => remove(row.id)} /></td>
                      </tr>
                    );
                  })}
            </tbody>
          </table>
        </div>
        <Pagination page={page} totalPages={totalPages} totalItems={filtered.length} onPageChange={setPage} />
      </div>
        </>);
      })()}
      {confirmElement}
    </>
  );
}

function RowActions({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="row-actions">
      <button type="button" className="btn btn-ghost btn-icon" onClick={onEdit} aria-label="수정"><IconEdit width={14} height={14} /></button>
      <button type="button" className="btn btn-danger btn-icon" onClick={onDelete} aria-label="삭제"><IconTrash width={14} height={14} /></button>
    </div>
  );
}

// ── 모달: 수입/지출 ─────────────────────────────────────────────
function LedgerModal({ state, categories, onClose, onSaved }: { state: { open: boolean; mode: 'add' | 'edit'; editing?: Transaction }; categories: Category[]; onClose: () => void; onSaved: () => void }) {
  const e = state.editing;
  const [type, setType] = useState<TransactionType>('expense');
  const [date, setDate] = useState('');
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('food');
  const [amount, setAmount] = useState('');
  const [payMethod, setPayMethod] = useState(PAY_METHODS[0]);
  const [memo, setMemo] = useState('');
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringCycle, setRecurringCycle] = useState<RecurringCycle>('monthly');
  const [recurringDay, setRecurringDay] = useState(1);
  const [weekendAdjust, setWeekendAdjust] = useState<WeekendAdjust>('none');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!state.open) return;
    setErrors({});
    setType(e?.type ?? 'expense');
    setDate(e?.date ?? new Date().toISOString().slice(0, 10));
    setTitle(e?.title ?? '');
    setCategory(e?.category ?? categories[0]?.code ?? 'food');
    setAmount(e ? String(e.amount) : '');
    setPayMethod(e?.payMethod ?? PAY_METHODS[0]);
    setMemo(e?.memo ?? '');
    setIsRecurring(e?.isRecurring ?? false);
    setRecurringCycle((e?.recurringRule?.cycle as RecurringCycle) ?? 'monthly');
    setRecurringDay(e?.recurringRule?.day ?? 1);
    setWeekendAdjust((e?.recurringRule?.weekendAdjust as WeekendAdjust) ?? 'none');
  }, [state.open, e]);

  function validate() {
    const err: Record<string, string> = {};
    if (!title.trim()) err.title = '내역을 입력하세요.';
    if (!amount || Number(amount) <= 0) err.amount = '금액을 입력하세요.';
    if (!date) err.date = '날짜를 선택하세요.';
    setErrors(err);
    return !Object.keys(err).length;
  }

  function clearErr(field: string) { setErrors((p) => { const n = { ...p }; delete n[field]; return n; }); }

  async function save() {
    if (!validate()) return;
    setSaving(true);
    try {
      const payload = {
        type, date, title, category, amount: Number(amount),
        // 결제수단은 지출에만 의미 — 수입/자산이동이면 미전송
        payMethod: type === 'expense' ? payMethod : undefined,
        memo: memo || undefined,
        isRecurring,
        recurringRule: isRecurring ? { cycle: recurringCycle, day: recurringDay, weekendAdjust } : undefined,
      };
      if (state.mode === 'edit' && e) await api.put(`/transactions/${e.id}`, payload);
      else await api.post('/transactions', payload);
      toast.success(state.mode === 'edit' ? '항목이 수정됐습니다.' : '항목이 추가됐습니다.');
      onSaved();
    } catch (x) {
      toast.error('저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={state.open} onClose={onClose} title={state.mode === 'edit' ? '항목 수정' : '항목 추가'} footer={<SaveFooter onClose={onClose} onSave={save} saving={saving} />}>
      <Field label="유형" required>
        <select className="input" value={type} onChange={(ev) => setType(ev.target.value as TransactionType)}>
          <option value="expense">지출</option><option value="income">수입</option><option value="transfer">자산이동</option>
        </select>
      </Field>
      <Field label="날짜" required error={errors.date}>
        <input type="date" className={`input${errors.date ? ' is-invalid' : ''}`} aria-label="날짜" value={date} onChange={(ev) => { setDate(ev.target.value); clearErr('date'); }} />
      </Field>
      <Field label="내역" required error={errors.title}>
        <input type="text" className={`input${errors.title ? ' is-invalid' : ''}`} placeholder="예: 스타벅스" value={title} onChange={(ev) => { setTitle(ev.target.value); clearErr('title'); }} />
      </Field>
      <div className="form-grid-2">
        <Field label="카테고리" required>
          <select className="input" value={category} onChange={(ev) => setCategory(ev.target.value)}>
            {categories.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
          </select>
        </Field>
        <Field label="금액 (원)" required error={errors.amount}>
          <input type="number" className={`input${errors.amount ? ' is-invalid' : ''}`} placeholder="0" value={amount} onChange={(ev) => { setAmount(ev.target.value); clearErr('amount'); }} />
        </Field>
      </div>
      {/* 결제수단은 지출일 때만 노출·필수 — 수입/자산이동엔 의미 없음 */}
      {type === 'expense' && (
        <Field label="결제수단" required>
          <select className="input" value={payMethod} onChange={(ev) => setPayMethod(ev.target.value)}>
            {PAY_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </Field>
      )}
      <Field label="메모 (선택)"><input type="text" className="input" placeholder="간단한 메모" value={memo} onChange={(ev) => setMemo(ev.target.value)} /></Field>

      <div className="recur-block">
        <label className="recur-toggle">
          <input type="checkbox" checked={isRecurring} onChange={(ev) => setIsRecurring(ev.target.checked)} />
          반복 거래로 등록
        </label>
        {isRecurring && (
          <>
            <div className="form-grid-2">
              <Field label="반복 주기" required>
                <select className="input" value={recurringCycle} onChange={(ev) => setRecurringCycle(ev.target.value as RecurringCycle)}>
                  <option value="monthly">매월</option>
                  <option value="weekly">매주</option>
                  <option value="yearly">매년</option>
                </select>
              </Field>
              <Field label="기준일" required>
                <select className="input" value={recurringDay} onChange={(ev) => setRecurringDay(Number(ev.target.value))}>
                  {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                    <option key={d} value={d}>{d}일</option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="주말인 경우">
              <div className="weekend-opts">
                <label><input type="radio" name="weekendAdjust" value="none" checked={weekendAdjust === 'none'} onChange={() => setWeekendAdjust('none')} />조정 안 함</label>
                <label><input type="radio" name="weekendAdjust" value="before" checked={weekendAdjust === 'before'} onChange={() => setWeekendAdjust('before')} />전 금요일</label>
                <label><input type="radio" name="weekendAdjust" value="after" checked={weekendAdjust === 'after'} onChange={() => setWeekendAdjust('after')} />다음 월요일</label>
              </div>
            </Field>
          </>
        )}
      </div>
    </Modal>
  );
}

// ── 모달: 예적금 ───────────────────────────────────────────────
function SavingsModal({ state, onClose, onSaved }: { state: { open: boolean; mode: 'add' | 'edit'; editing?: Saving }; onClose: () => void; onSaved: () => void }) {
  const e = state.editing;
  const [bank, setBank] = useState('');
  const [name, setName] = useState('');
  const [type, setType] = useState<SavingType>('savings');
  const [interestRate, setInterestRate] = useState('');
  const [monthlyAmount, setMonthlyAmount] = useState('');
  const [startDate, setStartDate] = useState('');
  const [maturityDate, setMaturityDate] = useState('');
  const [balance, setBalance] = useState('');
  const [memo, setMemo] = useState('');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!state.open) return;
    setErrors({});
    setBank(e?.bank ?? '');
    setName(e?.name ?? '');
    setType(e?.type ?? 'savings');
    setInterestRate(e ? String(e.interestRate) : '');
    setMonthlyAmount(e ? String(e.monthlyAmount) : '');
    setStartDate(e?.startDate ?? '');
    setMaturityDate(e?.maturityDate ?? '');
    setBalance(e ? String(e.balance) : '');
    setMemo(e?.memo ?? '');
  }, [state.open, e]);

  function validate() {
    const err: Record<string, string> = {};
    if (!bank.trim()) err.bank = '은행/기관을 입력하세요.';
    if (!name.trim()) err.name = '상품명을 입력하세요.';
    if (!startDate) err.startDate = '가입일을 선택하세요.';
    setErrors(err);
    return !Object.keys(err).length;
  }

  function clearErr(field: string) { setErrors((p) => { const n = { ...p }; delete n[field]; return n; }); }

  async function save() {
    if (!validate()) return;
    setSaving(true);
    try {
      const payload = {
        bank, name, type,
        // 금리·월납입·잔액은 선택 — 빈값이면 미전송(백엔드 기본 0)
        interestRate: interestRate ? Number(interestRate) : undefined,
        monthlyAmount: monthlyAmount ? Number(monthlyAmount) : undefined,
        startDate, maturityDate: maturityDate || undefined,
        balance: balance ? Number(balance) : undefined,
        memo: memo || undefined,
      };
      if (state.mode === 'edit' && e) await api.put(`/savings/${e.id}`, payload);
      else await api.post('/savings', payload);
      toast.success(state.mode === 'edit' ? '예적금이 수정됐습니다.' : '예적금이 추가됐습니다.');
      onSaved();
    } catch {
      toast.error('저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={state.open} onClose={onClose} title={state.mode === 'edit' ? '예적금 수정' : '예적금 추가'} footer={<SaveFooter onClose={onClose} onSave={save} saving={saving} />}>
      <Field label="은행/기관" required error={errors.bank}>
        <input type="text" className={`input${errors.bank ? ' is-invalid' : ''}`} placeholder="예: 카카오뱅크" value={bank} onChange={(ev) => { setBank(ev.target.value); clearErr('bank'); }} />
      </Field>
      <Field label="상품명" required error={errors.name}>
        <input type="text" className={`input${errors.name ? ' is-invalid' : ''}`} placeholder="예: 26주 적금" value={name} onChange={(ev) => { setName(ev.target.value); clearErr('name'); }} />
      </Field>
      <Field label="유형" required>
        <select className="input" value={type} onChange={(ev) => setType(ev.target.value as SavingType)}>
          <option value="savings">적금</option><option value="deposit">예금</option><option value="subscription">청약</option><option value="etc">기타</option>
        </select>
      </Field>
      <div className="form-grid-2">
        <Field label="금리 (%)">
          <input type="number" className="input" placeholder="3.5" step="0.1" value={interestRate} onChange={(ev) => setInterestRate(ev.target.value)} />
        </Field>
        <Field label="월 납입액 (원)"><input type="number" className="input" placeholder="200000" value={monthlyAmount} onChange={(ev) => setMonthlyAmount(ev.target.value)} /></Field>
      </div>
      <div className="form-grid-2">
        <Field label="가입일" required error={errors.startDate}>
          <input type="date" className={`input${errors.startDate ? ' is-invalid' : ''}`} aria-label="가입일" value={startDate} onChange={(ev) => { setStartDate(ev.target.value); clearErr('startDate'); }} />
        </Field>
        <Field label="만기일"><input type="date" className="input" aria-label="만기일" value={maturityDate} onChange={(ev) => setMaturityDate(ev.target.value)} /></Field>
      </div>
      <Field label="현재 잔액 (원)"><input type="number" className="input" placeholder="0" value={balance} onChange={(ev) => setBalance(ev.target.value)} /></Field>
      <Field label="메모 (선택)"><input type="text" className="input" placeholder="추가 메모" value={memo} onChange={(ev) => setMemo(ev.target.value)} /></Field>
    </Modal>
  );
}

// ── 모달: 투자 ─────────────────────────────────────────────────
function InvestModal({ state, onClose, onSaved }: { state: { open: boolean; mode: 'add' | 'edit'; editing?: Investment }; onClose: () => void; onSaved: () => void }) {
  const e = state.editing;
  const [name, setName] = useState('');
  const [type, setType] = useState<InvestmentType>('domestic_stock');
  const [principal, setPrincipal] = useState('');
  const [currentValue, setCurrentValue] = useState('');
  const [purchaseDate, setPurchaseDate] = useState('');
  const [memo, setMemo] = useState('');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!state.open) return;
    setErrors({});
    setName(e?.name ?? '');
    setType(e?.type ?? 'domestic_stock');
    setPrincipal(e ? String(e.principal) : '');
    setCurrentValue(e ? String(e.currentValue) : '');
    setPurchaseDate(e?.purchaseDate ?? '');
    setMemo(e?.memo ?? '');
  }, [state.open, e]);

  function validate() {
    const err: Record<string, string> = {};
    if (!name.trim()) err.name = '종목명을 입력하세요.';
    if (!principal || Number(principal) <= 0) err.principal = '투자원금을 입력하세요.';
    if (!currentValue || Number(currentValue) < 0) err.currentValue = '현재 평가금액을 입력하세요.';
    setErrors(err);
    return !Object.keys(err).length;
  }

  function clearErr(field: string) { setErrors((p) => { const n = { ...p }; delete n[field]; return n; }); }

  async function save() {
    if (!validate()) return;
    setSaving(true);
    try {
      const payload = { name, type, principal: Number(principal || 0), currentValue: Number(currentValue || 0), purchaseDate: purchaseDate || undefined, memo: memo || undefined };
      if (state.mode === 'edit' && e) await api.put(`/investments/${e.id}`, payload);
      else await api.post('/investments', payload);
      toast.success(state.mode === 'edit' ? '투자 항목이 수정됐습니다.' : '투자 항목이 추가됐습니다.');
      onSaved();
    } catch {
      toast.error('저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={state.open} onClose={onClose} title={state.mode === 'edit' ? '투자 항목 수정' : '투자 항목 추가'} footer={<SaveFooter onClose={onClose} onSave={save} saving={saving} />}>
      <Field label="종목명" required error={errors.name}>
        <input type="text" className={`input${errors.name ? ' is-invalid' : ''}`} placeholder="예: 삼성전자" value={name} onChange={(ev) => { setName(ev.target.value); clearErr('name'); }} />
      </Field>
      <Field label="유형" required>
        <select className="input" value={type} onChange={(ev) => setType(ev.target.value as InvestmentType)}>
          <option value="domestic_stock">국내주식</option><option value="foreign_stock">해외주식</option><option value="foreign_etf">해외ETF</option>
          <option value="domestic_etf">국내ETF</option><option value="crypto">가상자산</option><option value="etc">기타</option>
        </select>
      </Field>
      <div className="form-grid-2">
        <Field label="투자원금 (원)" required error={errors.principal}>
          <input type="number" className={`input${errors.principal ? ' is-invalid' : ''}`} placeholder="0" value={principal} onChange={(ev) => { setPrincipal(ev.target.value); clearErr('principal'); }} />
        </Field>
        <Field label="현재 평가금액 (원)" required error={errors.currentValue}>
          <input type="number" className={`input${errors.currentValue ? ' is-invalid' : ''}`} placeholder="매수 당일엔 투자원금과 동일" value={currentValue} onChange={(ev) => { setCurrentValue(ev.target.value); clearErr('currentValue'); }} />
        </Field>
      </div>
      <Field label="최초 매수일"><input type="date" className="input" aria-label="최초 매수일" value={purchaseDate} onChange={(ev) => setPurchaseDate(ev.target.value)} /></Field>
      <Field label="메모 (선택)"><input type="text" className="input" placeholder="투자 전략, 목표가 등" value={memo} onChange={(ev) => setMemo(ev.target.value)} /></Field>
    </Modal>
  );
}

// 모달 공통 푸터 (취소/저장) — 저장 중 비활성화
function SaveFooter({ onClose, onSave, saving }: { onClose: () => void; onSave: () => void; saving: boolean }) {
  return (
    <>
      <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>취소</button>
      <button type="button" className="btn btn-primary" onClick={onSave} disabled={saving}>{saving ? '저장 중...' : '저장'}</button>
    </>
  );
}

// 입력 그룹 (라벨 + 입력요소)
function Field({ label, required, error, children }: { label: string; required?: boolean; error?: string; children: ReactNode }) {
  return (
    <label className="input-group">
      <span className="input-label">{label}{required && <span className="required-mark">*</span>}</span>
      {children}
      {error && <span className="field-error">{error}</span>}
    </label>
  );
}
