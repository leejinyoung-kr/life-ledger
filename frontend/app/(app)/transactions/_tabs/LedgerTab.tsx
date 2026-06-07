'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import StatCard from '@/components/StatCard';
import Modal from '@/components/Modal';
import Pagination, { LimitSelect } from '@/components/Pagination';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card';
import { Field, ModalFooter } from '@/components/ui/Field';
import { useConfirm } from '@/components/ConfirmModal';
import {
  IconWon, IconBank, IconChart, IconSearch,
} from '@/components/icons';
import { notify } from '@/lib/toast';
import { api } from '@/lib/api';
import { downloadTransactionTemplate } from '@/lib/excel';
import {
  CATEGORY_LABEL, PAY_METHODS, TX_TYPE_LABEL, CYCLE_LABEL, WEEKEND_ADJUST_LABEL,
  won, signedWon, dotDate,
  type Category, type Transaction, type TransactionSummary, type TrendBucket,
  type TransactionType, type RecurringCycle, type WeekendAdjust,
} from '@/lib/finance';
import {
  TABLE_CARD, TXCARDS, TXCARD, TXCARD_TOP, TXCARD_TITLE, TXCARD_AMT, TXCARD_SUB, TXCARD_EMPTY,
  AMT_COLOR, RowActions, CardActions, toDay, monthsAgo,
} from '../_shared';

type ModalState = { open: boolean; mode: 'add' | 'edit'; editing?: Transaction };

export default function LedgerTab({ categories, addTrigger }: { categories: Category[]; addTrigger: number }) {
  const [pendingFrom, setPendingFrom] = useState(() => monthsAgo(1));
  const [pendingTo, setPendingTo] = useState(toDay);
  const [pendingType, setPendingType] = useState('');
  const [pendingCat, setPendingCat] = useState('');
  const [pendingQ, setPendingQ] = useState('');
  const [applied, setApplied] = useState(() => ({ from: monthsAgo(1), to: toDay(), type: '', cat: '', q: '' }));
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const { confirm, confirmElement } = useConfirm();
  const [rows, setRows] = useState<Transaction[]>([]);
  const [summary, setSummary] = useState<TransactionSummary | null>(null);
  const [trend, setTrend] = useState<TrendBucket[]>([]);
  const [recurring, setRecurring] = useState<Transaction[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [activePreset, setActivePreset] = useState<number | null>(1);
  const [reloadKey, setReloadKey] = useState(0);
  const [modal, setModal] = useState<ModalState>({ open: false, mode: 'add' });
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const mountTrigger = useRef(addTrigger);
  useEffect(() => {
    if (addTrigger !== mountTrigger.current) {
      mountTrigger.current = addTrigger;
      setModal({ open: true, mode: 'add' });
    }
  }, [addTrigger]);

  const catMap = Object.fromEntries(categories.map((c) => [c.code, c.label]));

  function search() { setApplied({ from: pendingFrom, to: pendingTo, type: pendingType, cat: pendingCat, q: pendingQ }); setPage(1); }

  function reset() {
    const from = monthsAgo(1); const to = toDay();
    setPendingFrom(from); setPendingTo(to);
    setPendingType(''); setPendingCat(''); setPendingQ('');
    setApplied({ from, to, type: '', cat: '', q: '' });
    setActivePreset(1); setPage(1);
  }

  function applyPreset(months: number) {
    setPendingFrom(monthsAgo(months)); setPendingTo(toDay());
    setActivePreset(months);
  }

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

  async function remove(id: number) {
    if (!await confirm('이 내역을 삭제할까요?', 'danger')) return;
    try {
      await api.del(`/transactions/${id}`);
      notify.deleted('내역');
      setSelected(new Set());
      setReloadKey((k) => k + 1);
    } catch {
      notify.deleteFailed();
    }
  }

  function toggleSelect(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    const ids = pagedRows.map((r) => r.id);
    const allSelected = ids.length > 0 && ids.every((id) => selected.has(id));
    setSelected(allSelected ? new Set() : new Set(ids));
  }

  async function removeSelected() {
    if (selected.size === 0) return;
    if (!await confirm(`선택한 ${selected.size}건을 삭제할까요?`, 'danger')) return;
    try {
      await api.del('/transactions/bulk', { ids: [...selected] });
      notify.deleted(`${selected.size}건`);
      setSelected(new Set());
      setReloadKey((k) => k + 1);
    } catch {
      notify.deleteFailed();
    }
  }

  async function downloadTemplate() {
    try {
      await downloadTransactionTemplate(categories.map((c) => c.label));
      notify.excelDownloaded();
    } catch {
      notify.error('양식 생성에 실패했습니다.');
    }
  }

  async function handleUpload(ev: React.ChangeEvent<HTMLInputElement>) {
    const file = ev.target.files?.[0];
    ev.target.value = '';
    if (!file) return;
    try {
      const res = await api.upload<{ imported: number; failed: number; errors: { row: number; message: string }[] }>('/transactions/import', file);
      if (res.failed > 0) {
        notify.excelPartial(res.imported, res.failed, ` (${res.errors.slice(0, 3).map((e) => `${e.row}행`).join(', ')}…)`);
      } else {
        notify.excelUploaded(res.imported);
      }
      setReloadKey((k) => k + 1);
    } catch (err) {
      notify.error((err as Error).message || '업로드에 실패했습니다.');
    }
  }

  async function downloadData() {
    const params = new URLSearchParams();
    if (applied.from) params.set('from', applied.from);
    if (applied.to) params.set('to', applied.to);
    if (applied.type) params.set('type', applied.type);
    if (applied.cat) params.set('category', applied.cat);
    if (applied.q) params.set('q', applied.q);
    try {
      await api.download(`/transactions/export?${params.toString()}`, '가계부.xlsx');
      notify.success('다운로드가 완료됐습니다.');
    } catch (err) {
      notify.error((err as Error).message || '다운로드에 실패했습니다.');
    }
  }

  const maxTrend = Math.max(1, ...trend.map((b) => b.total));
  const totalPages = Math.ceil(rows.length / limit);
  const pagedRows = rows.slice((page - 1) * limit, page * limit);

  return (
    <>
      {error && <p className="mt-3 text-[0.78rem] text-danger">⚠️ {error}</p>}

      {summary && (
        <div className="grid grid-cols-2 min-[1100px]:grid-cols-4 gap-4 mb-6">
          <StatCard icon={<IconWon />} tone="green" value={won(summary.income)} label="수입" change="이번 달 합계" changeDir="up" />
          <StatCard icon={<IconWon />} tone="red" value={won(summary.expense)} label="지출" change="이번 달 합계" changeDir="down" />
          <StatCard icon={<IconBank />} tone="amber" value={won(summary.realSpend)} label="실소비" change={`저축이동 ${won(summary.transfer)}`} changeDir="neutral" />
          <StatCard icon={<IconChart />} tone="blue" value={won(summary.balance)} label="잔액" change="수입 − 실소비" changeDir="neutral" />
        </div>
      )}

      <p className="text-[0.78rem] text-muted mb-6 [&_strong]:text-blue">
        💡 <strong>자산이동</strong>은 실소비가 아닌 자산 이동으로 잔액 계산에서 제외됩니다.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
        <Card>
          <CardHeader><CardTitle>월별 지출 추이</CardTitle></CardHeader>
          <CardBody>
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
          </CardBody>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>🔁 반복 거래</CardTitle>
            <Badge tone="neutral">자동 등록</Badge>
          </CardHeader>
          <CardBody compact>
            <div className="max-h-[264px] overflow-y-auto">
              {recurring.length === 0 && <div className="text-[0.72rem] text-muted">반복 거래가 없습니다.</div>}
              {recurring.map((r) => (
                <div className="py-2.5 border-b border-border-subtle last:border-b-0" key={r.id}>
                  <div className="text-[0.84rem] font-medium">{r.title} — {won(r.amount)}</div>
                  <div className="text-[0.72rem] text-muted">
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
          </CardBody>
        </Card>
      </div>

      <div className="flex gap-2 flex-wrap items-center mb-5 px-4 py-3 bg-surface border border-border rounded-[var(--radius)]">
        <span className="text-[0.75rem] font-semibold text-muted whitespace-nowrap mr-1">엑셀</span>
        <button type="button" className="excel-btn" onClick={downloadTemplate}>양식 다운로드</button>
        <label className="excel-btn upload">
          엑셀 업로드
          <input type="file" accept=".xlsx,.xls,.csv" hidden aria-label="엑셀 업로드" onChange={handleUpload} />
        </label>
        <div className="w-px bg-border self-stretch mx-1 shrink-0" />
        <button type="button" className="excel-btn" onClick={downloadData}>데이터 다운로드</button>
      </div>

      <div className="bg-surface border border-border rounded-[var(--radius-lg)] px-5 py-4 flex flex-col gap-3 mb-4">
        <div className="flex gap-2 items-center max-md:flex-wrap">
          <input type="date" className="input flex-[0_0_140px] w-[140px]" value={pendingFrom} onChange={(ev) => { setPendingFrom(ev.target.value); setActivePreset(null); }} aria-label="조회 시작일" />
          <span className="text-muted text-[0.82rem] shrink-0">~</span>
          <input type="date" className="input flex-[0_0_140px] w-[140px]" value={pendingTo} onChange={(ev) => { setPendingTo(ev.target.value); setActivePreset(null); }} aria-label="조회 종료일" />
          <div className="flex gap-1 shrink-0">
            <Button size="sm" variant={activePreset === 1 ? 'primary' : 'ghost'} onClick={() => applyPreset(1)}>1개월</Button>
            <Button size="sm" variant={activePreset === 2 ? 'primary' : 'ghost'} onClick={() => applyPreset(2)}>2개월</Button>
            <Button size="sm" variant={activePreset === 3 ? 'primary' : 'ghost'} onClick={() => applyPreset(3)}>3개월</Button>
          </div>
        </div>
        <div className="flex gap-2 items-center max-md:flex-wrap">
          <select className="input w-auto min-w-[120px] shrink-0" value={pendingType} onChange={(ev) => setPendingType(ev.target.value)} aria-label="유형 필터">
            <option value="">전체 유형</option>
            <option value="income">수입</option><option value="expense">지출</option><option value="transfer">자산이동</option>
          </select>
          <select className="input w-auto min-w-[120px] shrink-0" value={pendingCat} onChange={(ev) => setPendingCat(ev.target.value)} aria-label="카테고리 필터">
            <option value="">전체 카테고리</option>
            {categories.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
          </select>
          <div className="relative flex-1 min-w-[160px]">
            <IconSearch className="absolute left-[11px] top-1/2 -translate-y-1/2 text-muted w-[15px] h-[15px] pointer-events-none" />
            <input className="input pl-icon" type="text" placeholder="내역 검색..." value={pendingQ} onChange={(ev) => setPendingQ(ev.target.value)} onKeyDown={(ev) => ev.key === 'Enter' && search()} aria-label="내역 검색" />
          </div>
          <Button onClick={search}>조회</Button>
          <Button variant="ghost" onClick={reset}>초기화</Button>
        </div>
      </div>

      <div className="flex items-center justify-between mb-2">
        <span className="text-[0.78rem] text-secondary">총 {rows.length}건</span>
        <div className="flex items-center gap-2">
          <Button variant="danger" disabled={selected.size === 0} onClick={removeSelected}>선택삭제</Button>
          <LimitSelect limit={limit} onLimitChange={(n) => { setLimit(n); setPage(1); }} />
        </div>
      </div>

      <div className={TABLE_CARD}>
        <div className="table-wrap max-md:hidden">
          <table>
            <colgroup>
              <col style={{ width: '40px' }} />
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
                <th className="td-center"><input type="checkbox" className="checkbox" checked={pagedRows.length > 0 && pagedRows.every((r) => selected.has(r.id))} onChange={toggleSelectAll} aria-label="전체선택" /></th>
                <th>번호</th><th>유형</th><th>카테고리</th><th>내역</th>
                <th>결제수단</th><th>금액</th><th>메모</th>
                <th>날짜</th><th>관리</th>
              </tr>
            </thead>
            <tbody>
              {pagedRows.length === 0 && <tr><td colSpan={10} className="td-center td-muted">내역이 없습니다.</td></tr>}
              {pagedRows.map((row, i) => (
                <tr key={row.id}>
                  <td className="td-center"><input type="checkbox" className="checkbox" checked={selected.has(row.id)} onChange={() => toggleSelect(row.id)} aria-label="선택" /></td>
                  <td className="td-center td-muted">{rows.length - (page - 1) * limit - i}</td>
                  <td className="td-center"><span className={`type-badge ${row.type}`}>{TX_TYPE_LABEL[row.type]}</span></td>
                  <td className="td-center"><span className="cat-chip">{catMap[row.category] ?? row.category}</span></td>
                  <td className="td-name">{(row.isRecurring || row.recurringParentId) && <span title="반복 거래">🔁 </span>}{row.title}</td>
                  <td className="td-center td-muted">{row.payMethod}</td>
                  <td className={`td-right amount-${row.type}`}>{signedWon(row.type, row.amount)}</td>
                  <td className="td-center td-muted">{row.memo ?? '-'}</td>
                  <td className="td-center td-muted">{dotDate(row.date)}</td>
                  <td className="td-center"><RowActions onEdit={() => setModal({ open: true, mode: 'edit', editing: row })} onDelete={() => remove(row.id)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className={TXCARDS}>
          {pagedRows.length === 0 && <div className={TXCARD_EMPTY}>내역이 없습니다.</div>}
          {pagedRows.map((row) => (
            <div className={TXCARD} key={row.id}>
              <div className="flex items-center gap-2 mb-1.5">
                <input type="checkbox" className="checkbox" checked={selected.has(row.id)} onChange={() => toggleSelect(row.id)} aria-label="선택" />
                <div className="flex-1 flex justify-between items-baseline gap-2.5">
                  <span className={TXCARD_TITLE}>{(row.isRecurring || row.recurringParentId) && '🔁 '}{row.title}</span>
                  <span className={`${TXCARD_AMT} ${AMT_COLOR[row.type]}`}>{signedWon(row.type, row.amount)}</span>
                </div>
              </div>
              <div className={TXCARD_SUB}>
                <span className={`type-badge ${row.type}`}>{TX_TYPE_LABEL[row.type]}</span>
                <span className="cat-chip">{catMap[row.category] ?? row.category}</span>
                {row.type === 'expense' && <span>{row.payMethod}</span>}
                <span>{dotDate(row.date)}</span>
                {row.memo && <span>· {row.memo}</span>}
              </div>
              <CardActions onEdit={() => setModal({ open: true, mode: 'edit', editing: row })} onDelete={() => remove(row.id)} />
            </div>
          ))}
        </div>
        <Pagination page={page} totalPages={totalPages} totalItems={rows.length} onPageChange={setPage} />
      </div>

      <LedgerModal
        state={modal}
        categories={categories}
        onClose={() => setModal((s) => ({ ...s, open: false }))}
        onSaved={() => { setModal((s) => ({ ...s, open: false })); setReloadKey((k) => k + 1); }}
      />
      {confirmElement}
    </>
  );
}

function LedgerModal({ state, categories, onClose, onSaved }: { state: ModalState; categories: Category[]; onClose: () => void; onSaved: () => void }) {
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
  const [scope, setScope] = useState<'one' | 'future' | 'all'>('one');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const editingRecurring = state.mode === 'edit' && !!(e?.isRecurring || e?.recurringParentId);

  useEffect(() => {
    if (!state.open) return;
    setErrors({});
    setScope('one');
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
        payMethod: type === 'expense' ? payMethod : undefined,
        memo: memo || undefined,
        isRecurring,
        recurringRule: isRecurring ? { cycle: recurringCycle, day: recurringDay, weekendAdjust } : undefined,
        scope: editingRecurring ? scope : undefined,
      };
      if (state.mode === 'edit' && e) await api.put(`/transactions/${e.id}`, payload);
      else await api.post('/transactions', payload);
      notify.upserted(state.mode, '항목');
      onSaved();
    } catch {
      notify.saveFailed();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={state.open} onClose={onClose} title={state.mode === 'edit' ? '항목 수정' : '항목 추가'} footer={<ModalFooter onClose={onClose} onSave={save} saving={saving} />}>
      {editingRecurring && (
        <div className="flex flex-col gap-2 p-3.5 bg-surface border border-border rounded-[var(--radius)]">
          <span className="text-[0.8rem] font-medium text-secondary">🔁 반복 거래 — 수정 범위</span>
          <div className="flex gap-4 flex-wrap text-[0.82rem] text-secondary [&_label]:flex [&_label]:items-center [&_label]:gap-1.5 [&_label]:cursor-pointer [&_input]:accent-accent">
            <label><input type="radio" name="scope" checked={scope === 'one'} onChange={() => setScope('one')} />이 항목만</label>
            <label><input type="radio" name="scope" checked={scope === 'future'} onChange={() => setScope('future')} />이후 전체</label>
            <label><input type="radio" name="scope" checked={scope === 'all'} onChange={() => setScope('all')} />전체</label>
          </div>
          <span className="text-[0.72rem] text-muted">날짜는 해당 회차만 변경됩니다. 금액·내역 등은 선택 범위에 적용됩니다.</span>
        </div>
      )}
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
      <div className="grid grid-cols-2 gap-4 max-md:grid-cols-1">
        <Field label="카테고리" required>
          <select className="input" value={category} onChange={(ev) => setCategory(ev.target.value)}>
            {categories.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
          </select>
        </Field>
        <Field label="금액 (원)" required error={errors.amount}>
          <input type="number" className={`input${errors.amount ? ' is-invalid' : ''}`} placeholder="0" value={amount} onChange={(ev) => { setAmount(ev.target.value); clearErr('amount'); }} />
        </Field>
      </div>
      {type === 'expense' && (
        <Field label="결제수단" required>
          <select className="input" value={payMethod} onChange={(ev) => setPayMethod(ev.target.value)}>
            {PAY_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </Field>
      )}
      <Field label="메모 (선택)"><input type="text" className="input" placeholder="간단한 메모" value={memo} onChange={(ev) => setMemo(ev.target.value)} /></Field>

      <div className="flex flex-col gap-3 p-3.5 bg-surface border border-border rounded-[var(--radius)]">
        <label className="flex items-center gap-2 text-[0.875rem] font-medium text-primary cursor-pointer select-none [&_input]:w-4 [&_input]:h-4 [&_input]:accent-accent [&_input]:cursor-pointer">
          <input type="checkbox" checked={isRecurring} onChange={(ev) => setIsRecurring(ev.target.checked)} />
          반복 거래로 등록
        </label>
        {isRecurring && (
          <>
            <div className="grid grid-cols-2 gap-4 max-md:grid-cols-1">
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
              <div className="flex gap-5 flex-wrap [&_label]:flex [&_label]:items-center [&_label]:gap-[5px] [&_label]:text-[0.82rem] [&_label]:text-secondary [&_label]:cursor-pointer [&_input]:accent-accent">
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
