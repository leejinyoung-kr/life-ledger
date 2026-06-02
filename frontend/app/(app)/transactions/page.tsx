'use client';

/**
 * 가계부 페이지.
 * 수입/지출 · 예적금 · 투자 3개 탭을 한 화면에서 관리한다.
 * 데이터는 백엔드 API(/transactions, /savings, /investments)와 실시간 연동한다.
 */
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import AppShell from '@/components/AppShell';
import Modal from '@/components/Modal';
import {
  IconWon, IconBank, IconTrendUp, IconDownload, IconFileBlank, IconUpload,
  IconSearch, IconEdit, IconTrash, IconPlus,
} from '@/components/icons';

import { toast } from 'sonner';
import { useConfirm } from '@/components/ConfirmModal';
import Pagination, { LimitSelect } from '@/components/Pagination';
import { api } from '@/lib/api';
import {
  CATEGORY_LABEL, CATEGORY_OPTIONS, PAY_METHODS, SAVING_TYPE_LABEL, INVEST_TYPE_LABEL,
  TX_TYPE_LABEL, won, signedWon, dotDate, daysUntil, currentMonth,
  type Transaction, type TransactionSummary, type TrendBucket,
  type Saving, type SavingSummary, type SavingType,
  type Investment, type InvestmentSummary, type InvestmentType, type TransactionType,
} from '@/lib/finance';

type TabId = 'ledger' | 'savings' | 'invest';

const ADD_LABELS: Record<TabId, string> = {
  ledger: '항목 추가',
  savings: '예적금 추가',
  invest: '투자 항목 추가',
};

export default function TransactionsPage() {
  const [tab, setTab] = useState<TabId>('ledger');
  // 각 탭의 reloadKey — mutation 후 증가시켜 해당 탭 데이터 재조회
  const [reload, setReload] = useState({ ledger: 0, savings: 0, invest: 0 });
  const bump = (k: TabId) => setReload((s) => ({ ...s, [k]: s[k] + 1 }));

  // 모달 상태 (open + mode + 편집 대상)
  const [ledgerModal, setLedgerModal] = useState<{ open: boolean; mode: 'add' | 'edit'; editing?: Transaction }>({ open: false, mode: 'add' });
  const [savingsModal, setSavingsModal] = useState<{ open: boolean; mode: 'add' | 'edit'; editing?: Saving }>({ open: false, mode: 'add' });
  const [investModal, setInvestModal] = useState<{ open: boolean; mode: 'add' | 'edit'; editing?: Investment }>({ open: false, mode: 'add' });

  // 상단바 추가 버튼 — 현재 탭에 맞는 추가 모달 열기
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
        <button type="button" className="btn btn-primary" onClick={openAddModal}>
          <IconPlus width={13} height={13} />{ADD_LABELS[tab]}
        </button>
      </div>

      <div className="page-tabs">
        <Tab active={tab === 'ledger'} onClick={() => setTab('ledger')} icon={<IconWon />}>수입 / 지출</Tab>
        <Tab active={tab === 'savings'} onClick={() => setTab('savings')} icon={<IconBank />}>예적금</Tab>
        <Tab active={tab === 'invest'} onClick={() => setTab('invest')} icon={<IconTrendUp />}>투자</Tab>
      </div>

      {tab === 'ledger' && (
        <LedgerTab
          reloadKey={reload.ledger}
          onEdit={(tx) => setLedgerModal({ open: true, mode: 'edit', editing: tx })}
          onDeleted={() => bump('ledger')}
        />
      )}
      {tab === 'savings' && (
        <SavingsTab
          reloadKey={reload.savings}
          onAdd={() => setSavingsModal({ open: true, mode: 'add' })}
          onEdit={(s) => setSavingsModal({ open: true, mode: 'edit', editing: s })}
          onDeleted={() => bump('savings')}
        />
      )}
      {tab === 'invest' && (
        <InvestTab
          reloadKey={reload.invest}
          onAdd={() => setInvestModal({ open: true, mode: 'add' })}
          onEdit={(v) => setInvestModal({ open: true, mode: 'edit', editing: v })}
          onDeleted={() => bump('invest')}
        />
      )}

      <LedgerModal
        state={ledgerModal}
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

// ── 탭 1: 수입 / 지출 ───────────────────────────────────────────
function LedgerTab({ reloadKey, onEdit, onDeleted }: { reloadKey: number; onEdit: (tx: Transaction) => void; onDeleted: () => void }) {
  const [month, setMonth] = useState(currentMonth());
  const [typeFilter, setTypeFilter] = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const { confirm, confirmElement } = useConfirm();

  const [rows, setRows] = useState<Transaction[]>([]);
  const [summary, setSummary] = useState<TransactionSummary | null>(null);
  const [trend, setTrend] = useState<TrendBucket[]>([]);
  const [recurring, setRecurring] = useState<Transaction[]>([]);
  const [error, setError] = useState<string | null>(null);

  // 내역 목록 조회 (필터 반영)
  const loadRows = useCallback(async () => {
    const params = new URLSearchParams({ month });
    if (typeFilter) params.set('type', typeFilter);
    if (catFilter) params.set('category', catFilter);
    if (q) params.set('q', q);
    try {
      setRows(await api.get<Transaction[]>(`/transactions?${params.toString()}`));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [month, typeFilter, catFilter, q]);

  // 요약/추이/반복거래 조회 (월 기준)
  const loadAside = useCallback(async () => {
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
  }, [month]);

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

  const maxTrend = Math.max(1, ...trend.map((b) => b.total));
  const totalPages = Math.ceil(rows.length / limit);
  const pagedRows = rows.slice((page - 1) * limit, page * limit);
  const strip = summary
    ? [
        { label: '수입', value: signedWon('income', summary.income), tone: 'income' },
        { label: '지출', value: signedWon('expense', summary.expense), tone: 'expense' },
        { label: '저축이동', value: signedWon('transfer', summary.transfer), tone: 'transfer' },
        { label: '실소비', value: won(summary.realSpend), tone: '' },
        { label: '잔액', value: won(summary.balance), tone: '' },
      ]
    : [];

  return (
    <>
      {error && <p className="ledger-note is-error">⚠️ {error}</p>}

      <div className="grid-2 mb-6">
        <div className="card">
          <div className="card-header"><span className="card-title">월별 지출 추이</span></div>
          <div className="card-body">
            <div className="bar-chart">
              {trend.map((b) => (
                <div key={b.month} className={`bar${b.month === month ? ' current' : ''}`} style={{ height: `${Math.round((b.total / maxTrend) * 100)}%` }} />
              ))}
            </div>
            <div className="bar-axis">{trend.map((b) => <span key={b.month}>{b.label}</span>)}</div>
          </div>
        </div>
        <div className="card">
          <div className="card-header">
            <span className="card-title">🔁 반복 거래</span>
            <span className="badge badge-neutral">자동 등록</span>
          </div>
          <div className="card-body compact">
            {recurring.length === 0 && <div className="recur-sub">반복 거래가 없습니다.</div>}
            {recurring.map((r) => (
              <div className="recur-item" key={r.id}>
                <div className="recur-title">{r.title} — {won(r.amount)}</div>
                <div className="recur-sub">{CATEGORY_LABEL[r.category] ?? r.category} · {TX_TYPE_LABEL[r.type]}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="summary-strip">
        {strip.map((s, i) => <StripItem key={s.label} item={s} last={i === strip.length - 1} />)}
      </div>

      {/* 엑셀 툴바 — TODO: 다운로드/업로드 API 연동 (Phase 4-5) */}
      <div className="excel-toolbar">
        <span className="excel-toolbar-label">엑셀</span>
        <button type="button" className="excel-btn"><IconDownload />데이터 다운로드</button>
        <div className="divider-v" />
        <button type="button" className="excel-btn"><IconFileBlank />양식 다운로드</button>
        <label className="excel-btn upload">
          <IconUpload />엑셀 업로드
          <input type="file" accept=".xlsx,.xls,.csv" hidden aria-label="엑셀 업로드" />
        </label>
      </div>

      <div className="filter-row">
        <input type="month" className="input" value={month} onChange={(ev) => { setMonth(ev.target.value); setPage(1); }} aria-label="조회 월" />
        <select className="input" value={typeFilter} onChange={(ev) => setTypeFilter(ev.target.value)} aria-label="유형 필터">
          <option value="">전체 유형</option>
          <option value="income">수입</option><option value="expense">지출</option><option value="transfer">저축이동</option>
        </select>
        <select className="input" value={catFilter} onChange={(ev) => setCatFilter(ev.target.value)} aria-label="카테고리 필터">
          <option value="">전체 카테고리</option>
          {CATEGORY_OPTIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
        <div className="search-wrap filter-search">
          <IconSearch className="search-icon" />
          <input className="input" type="text" placeholder="내역 검색..." value={q} onChange={(ev) => { setQ(ev.target.value); setPage(1); }} aria-label="내역 검색" />
        </div>
        <LimitSelect limit={limit} onLimitChange={(n) => { setLimit(n); setPage(1); }} />
      </div>

      <div className="card flush">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>날짜</th><th>내역</th><th>카테고리</th><th>결제수단</th>
                <th className="td-right">금액</th><th className="td-center">메모</th><th className="td-center">액션</th>
              </tr>
            </thead>
            <tbody>
              {pagedRows.length === 0 && (
                <tr><td colSpan={7} className="td-center td-muted">내역이 없습니다.</td></tr>
              )}
              {pagedRows.map((row) => (
                <tr key={row.id}>
                  <td className="td-muted">{dotDate(row.date)}</td>
                  <td className="td-name">{row.title}</td>
                  <td><span className={`cat-chip${row.type === 'transfer' ? ' transfer' : ''}`}>{CATEGORY_LABEL[row.category] ?? row.category}</span></td>
                  <td className="td-muted">{row.payMethod}</td>
                  <td className={`td-right amount-${row.type}`}>{signedWon(row.type, row.amount)}</td>
                  <td className="td-center td-muted">{row.memo ?? '-'}</td>
                  <td className="td-center"><RowActions onEdit={() => onEdit(row)} onDelete={() => remove(row.id)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card flush">
        <Pagination page={page} totalPages={totalPages} totalItems={rows.length} onPageChange={setPage} />
      </div>
      <p className="ledger-note">
        💡 <strong>저축이동</strong>은 실소비가 아닌 자산 이동으로 잔액 계산에서 제외됩니다.
      </p>
      {confirmElement}
    </>
  );
}

// ── 탭 2: 예적금 ───────────────────────────────────────────────
function SavingsTab({ reloadKey, onAdd, onEdit, onDeleted }: { reloadKey: number; onAdd: () => void; onEdit: (s: Saving) => void; onDeleted: () => void }) {
  const [rows, setRows] = useState<Saving[]>([]);
  const [summary, setSummary] = useState<SavingSummary | null>(null);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const { confirm, confirmElement } = useConfirm();

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

  const strip = summary
    ? [
        { label: '총 예적금', value: won(summary.totalBalance), tone: 'transfer' },
        { label: '이번 달 납입', value: won(summary.monthlyDeposit), tone: '' },
        { label: '평균 금리', value: `${summary.avgRate}%`, tone: 'accent' },
        { label: '만기 임박', value: `${summary.maturityNear}건`, tone: summary.maturityNear > 0 ? 'warning' : '' },
      ]
    : [];

  return (
    <>
      <div className="summary-strip">
        {strip.map((s, i) => <StripItem key={s.label} item={s} last={i === strip.length - 1} />)}
      </div>

      {(() => {
        const totalPages = Math.ceil(rows.length / limit);
        const paged = rows.slice((page - 1) * limit, page * limit);
        return (
          <>
            <div className="flex-end mb-4">
              <LimitSelect limit={limit} onLimitChange={(n) => { setLimit(n); setPage(1); }} />
            </div>
            <div className="savings-grid">
              {paged.map((c) => {
          const dleft = daysUntil(c.maturityDate);
          const near = dleft !== null && dleft >= 0 && dleft <= 30;
          return (
            <div className="savings-card" key={c.id}>
              <div className="savings-card-header">
                <div>
                  <div className="savings-bank">{c.bank}</div>
                  <div className="savings-name">{c.name}</div>
                </div>
                <span className={`savings-type-badge ${c.type === 'deposit' ? 'badge-deposit' : 'badge-savings'}`}>{SAVING_TYPE_LABEL[c.type]}</span>
              </div>
              <div className="savings-amount">{won(c.balance)}</div>
              <div className="savings-meta">
                <MetaRow label="월 납입액" value={c.monthlyAmount > 0 ? won(c.monthlyAmount) : '-'} />
                <MetaRow label="금리" value={`${c.interestRate}%`} accent />
                <MetaRow label="가입일" value={dotDate(c.startDate)} />
                <MetaRow label="만기일" value={c.maturityDate ? `${dotDate(c.maturityDate)}${near ? ` ⚠️ D-${dleft}` : ''}` : '-'} warning={near} />
              </div>
              <div className="savings-actions">
                <button type="button" className="btn btn-ghost grow" onClick={() => onEdit(c)}>수정</button>
                <button type="button" className="btn btn-danger" onClick={() => remove(c.id)}>삭제</button>
              </div>
            </div>
          );
        })}

              <div className="savings-card add" onClick={onAdd}>
                <IconPlus width={28} height={28} />
                <span>예적금 추가</span>
              </div>
            </div>
            <Pagination page={page} totalPages={totalPages} totalItems={rows.length} onPageChange={setPage} />
          </>
        );
      })()}
      {confirmElement}
    </>
  );
}

function MetaRow({ label, value, accent, warning }: { label: string; value: string; accent?: boolean; warning?: boolean }) {
  return (
    <div className="savings-meta-row">
      <span className="savings-meta-label">{label}</span>
      <span className={`savings-meta-value${accent ? ' accent' : ''}${warning ? ' warning' : ''}`}>{value}</span>
    </div>
  );
}

// ── 탭 3: 투자 ─────────────────────────────────────────────────
function InvestTab({ reloadKey, onAdd, onEdit, onDeleted }: { reloadKey: number; onAdd: () => void; onEdit: (v: Investment) => void; onDeleted: () => void }) {
  const [rows, setRows] = useState<Investment[]>([]);
  const [summary, setSummary] = useState<InvestmentSummary | null>(null);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
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
  const stats = summary
    ? [
        { label: '총 평가금액', value: won(summary.totalValue), valueClass: '', change: `${profitUp ? '▲' : '▼'} ${won(summary.totalProfit)} (${summary.profitRate}%)`, changeClass: profitUp ? 'up' : 'down' },
        { label: '총 투자원금', value: won(summary.totalPrincipal), valueClass: '', change: '', changeClass: '' },
        { label: '총 수익', value: `${profitUp ? '+' : '-'}${won(summary.totalProfit)}`, valueClass: profitUp ? 'up' : 'down', change: `수익률 ${profitUp ? '+' : ''}${summary.profitRate}%`, changeClass: profitUp ? 'up' : 'down' },
      ]
    : [];

  return (
    <>
      <div className="invest-summary">
        {stats.map((s) => (
          <div className="invest-stat" key={s.label}>
            <div className="invest-stat-label">{s.label}</div>
            <div className={`invest-stat-value ${s.valueClass}`}>{s.value}</div>
            {s.change && <div className={`invest-stat-change ${s.changeClass}`}>{s.change}</div>}
          </div>
        ))}
      </div>

      <div className="flex-end mb-4">
        <LimitSelect limit={limit} onLimitChange={(n) => { setLimit(n); setPage(1); }} />
      </div>
      <div className="card flush mb-6">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>종목</th><th>유형</th>
                <th className="td-right">투자원금</th><th className="td-right">평가금액</th>
                <th className="td-right">수익</th><th className="td-center">수익률</th>
                <th>메모</th><th className="td-center">액션</th>
              </tr>
            </thead>
            <tbody>
              {(() => { const paged = rows.slice((page-1)*limit, page*limit); return (
                <>
                  {paged.length === 0 && (
                    <tr><td colSpan={8} className="td-center td-muted">투자 항목이 없습니다.</td></tr>
                  )}
                  {paged.map((row) => {
                const up = row.profit >= 0;
                return (
                  <tr key={row.id}>
                    <td className="td-strong">{row.name}</td>
                    <td><span className="cat-chip">{INVEST_TYPE_LABEL[row.type]}</span></td>
                    <td className="td-mono td-right">{won(row.principal)}</td>
                    <td className="td-mono td-right">{won(row.currentValue)}</td>
                    <td className={`td-right amount-${up ? 'income' : 'expense'}`}>{up ? '+' : '-'}{won(row.profit)}</td>
                    <td className="td-center"><span className={`return-pill ${up ? 'up' : 'down'}`}>{up ? '+' : ''}{row.profitRate}%</span></td>
                    <td className="td-muted">{row.memo ?? '-'}</td>
                    <td className="td-center"><RowActions onEdit={() => onEdit(row)} onDelete={() => remove(row.id)} /></td>
                  </tr>
                );
              })}
                </>
              ); })()}
            </tbody>
          </table>
        </div>
      </div>
      <Pagination page={page} totalPages={Math.ceil(rows.length / limit)} totalItems={rows.length} onPageChange={setPage} />

      <div className="flex-end">
        <button type="button" className="btn btn-primary" onClick={onAdd}>
          <IconPlus width={13} height={13} />투자 항목 추가
        </button>
      </div>
      {confirmElement}
    </>
  );
}

function StripItem({ item, last }: { item: { label: string; value: string; tone: string }; last: boolean }) {
  return (
    <>
      <div className="strip-item">
        <span className="strip-label">{item.label}</span>
        <span className={`strip-value ${item.tone}`}>{item.value}</span>
      </div>
      {!last && <div className="strip-divider" />}
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
function LedgerModal({ state, onClose, onSaved }: { state: { open: boolean; mode: 'add' | 'edit'; editing?: Transaction }; onClose: () => void; onSaved: () => void }) {
  const e = state.editing;
  const [type, setType] = useState<TransactionType>('expense');
  const [date, setDate] = useState('');
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('food');
  const [amount, setAmount] = useState('');
  const [payMethod, setPayMethod] = useState(PAY_METHODS[0]);
  const [memo, setMemo] = useState('');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!state.open) return;
    setErrors({});
    setType(e?.type ?? 'expense');
    setDate(e?.date ?? new Date().toISOString().slice(0, 10));
    setTitle(e?.title ?? '');
    setCategory(e?.category ?? 'food');
    setAmount(e ? String(e.amount) : '');
    setPayMethod(e?.payMethod ?? PAY_METHODS[0]);
    setMemo(e?.memo ?? '');
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
      const payload = { type, date, title, category, amount: Number(amount), payMethod, memo: memo || undefined };
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
          <option value="expense">지출</option><option value="income">수입</option><option value="transfer">저축이동</option>
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
            {CATEGORY_OPTIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </Field>
        <Field label="금액 (원)" required error={errors.amount}>
          <input type="number" className={`input${errors.amount ? ' is-invalid' : ''}`} placeholder="0" value={amount} onChange={(ev) => { setAmount(ev.target.value); clearErr('amount'); }} />
        </Field>
      </div>
      <Field label="결제수단" required>
        <select className="input" value={payMethod} onChange={(ev) => setPayMethod(ev.target.value)}>
          {PAY_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
      </Field>
      <Field label="메모 (선택)"><input type="text" className="input" placeholder="간단한 메모" value={memo} onChange={(ev) => setMemo(ev.target.value)} /></Field>
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
    if (!interestRate) err.interestRate = '금리를 입력하세요.';
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
        interestRate: Number(interestRate), monthlyAmount: Number(monthlyAmount || 0),
        startDate, maturityDate: maturityDate || undefined,
        balance: Number(balance || 0), memo: memo || undefined,
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
        <Field label="금리 (%)" required error={errors.interestRate}>
          <input type="number" className={`input${errors.interestRate ? ' is-invalid' : ''}`} placeholder="3.5" step="0.1" value={interestRate} onChange={(ev) => { setInterestRate(ev.target.value); clearErr('interestRate'); }} />
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
    setErrors(err);
    return !Object.keys(err).length;
  }

  function clearErr(field: string) { setErrors((p) => { const n = { ...p }; delete n[field]; return n; }); }

  async function save() {
    if (!validate()) return;
    setSaving(true);
    try {
      const payload = { name, type, principal: Number(principal || 0), currentValue: Number(currentValue || 0), purchaseDate, memo: memo || undefined };
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
        <Field label="현재 평가금액 (원)"><input type="number" className="input" placeholder="0" value={currentValue} onChange={(ev) => setCurrentValue(ev.target.value)} /></Field>
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
