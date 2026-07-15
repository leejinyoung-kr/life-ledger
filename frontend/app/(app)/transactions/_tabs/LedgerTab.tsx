'use client';

import { useEffect, useMemo, useState } from 'react';
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
import { useApiQuery, useInvalidate, type Paginated } from '@/lib/query';
import { useFormErrors } from '@/lib/useFormErrors';
import { qk } from '@/lib/queryKeys';
import { downloadTransactionTemplate } from '@/lib/excel';
import { usePagination } from '@/lib/usePagination';
import { useRowSelection } from '@/lib/useRowSelection';
import {
  PAY_METHODS, TX_TYPE_LABEL, WEEKEND_ADJUST_LABEL, TRANSFER_TARGET_LABEL, TRANSFER_DIRECTION_LABEL, recurringRuleSummary, WEEKDAY_LABEL,
  won, signedWon, dotDate,
  type Category, type Transaction, type TransactionSummary, type TrendBucket,
  type TransactionType, type RecurringCycle, type WeekendAdjust, type TransferTarget, type TransferDirection,
  type Saving, type InvestmentAccount, type RecurringSchedule,
} from '@/lib/finance';
import type { Asset } from '@/lib/networth';
import {
  TABLE_CARD, TXCARDS, TXCARD, TXCARD_TITLE, TXCARD_AMT, TXCARD_EMPTY,
  AMT_COLOR, RowActions, CardActions, toDay, monthsAgo, useAddTrigger,
} from '../_shared';

// prefill: 내역 복사(handleDuplicate) 등으로 추가 모달을 미리 채울 때 사용
type LedgerDraft = {
  date?: string; title?: string; amount?: number;
  type?: TransactionType; category?: string; payMethod?: string; memo?: string;
};
type ModalState = { open: boolean; mode: 'add' | 'edit'; editing?: Transaction; prefill?: LedgerDraft };
type RecurringModalState = { open: boolean; editing?: RecurringSchedule };

export default function LedgerTab({ categories, bankCats, addTrigger }: { categories: Category[]; bankCats: Category[]; addTrigger: number }) {
  const [pendingFrom, setPendingFrom] = useState(() => monthsAgo(1));
  const [pendingTo, setPendingTo] = useState(toDay);
  const [pendingType, setPendingType] = useState('');
  const [pendingCat, setPendingCat] = useState('');
  const [pendingQ, setPendingQ] = useState('');
  const [applied, setApplied] = useState(() => ({ from: monthsAgo(1), to: toDay(), type: '', cat: '', q: '' }));
  const { page, setPage, limit, changeLimit } = usePagination();
  const { confirm, confirmElement } = useConfirm();
  const [activePreset, setActivePreset] = useState<number | null>(1);
  const [modal, setModal] = useState<ModalState>({ open: false, mode: 'add' });
  const [recurringModal, setRecurringModal] = useState<RecurringModalState>({ open: false });
  const invalidate = useInvalidate();

  useAddTrigger(addTrigger, () => setModal({ open: true, mode: 'add' }));

  const catMap = Object.fromEntries(categories.map((c) => [c.code, c.label]));
  // 2계층: 대분류(parentCode 없음) / 소분류(parentCode 있음) 분리. 필터·엑셀·표시에 사용
  const parentCats = useMemo(() => categories.filter((c) => !c.parentCode), [categories]);
  const leafCats = useMemo(() => categories.filter((c) => c.parentCode), [categories]);

  function handleSearch() { setApplied({ from: pendingFrom, to: pendingTo, type: pendingType, cat: pendingCat, q: pendingQ }); setPage(1); }

  function handleReset() {
    const from = monthsAgo(1); const to = toDay();
    setPendingFrom(from); setPendingTo(to);
    setPendingType(''); setPendingCat(''); setPendingQ('');
    setApplied({ from, to, type: '', cat: '', q: '' });
    setActivePreset(1); setPage(1);
  }

  function handleApplyPreset(months: number) {
    setPendingFrom(monthsAgo(months)); setPendingTo(toDay());
    setActivePreset(months);
  }

  // 거래 목록 — 필터(applied)+페이지 별 캐시. 페이징은 서버에서 처리(page/limit 전송)
  const listQs = useMemo(() => {
    const params = new URLSearchParams();
    if (applied.from) params.set('from', applied.from);
    if (applied.to) params.set('to', applied.to);
    if (applied.type) params.set('type', applied.type);
    if (applied.cat) params.set('category', applied.cat);
    if (applied.q) params.set('q', applied.q);
    params.set('page', String(page));
    params.set('limit', String(limit));
    return params.toString();
  }, [applied, page, limit]);
  const month = applied.to.slice(0, 7);

  const rowsQuery = useApiQuery<Paginated<Transaction>>(qk.transactions.list({ ...applied, page, limit }), `/transactions?${listQs}`);
  const summaryQuery = useApiQuery<TransactionSummary>(qk.transactions.summary(month), `/transactions/summary?month=${month}`);
  const trendQuery = useApiQuery<TrendBucket[]>(qk.transactions.monthlyTrend(month), `/transactions/monthly-trend?month=${month}`);
  const recurringQuery = useApiQuery<RecurringSchedule[]>(qk.recurringSchedules.list('transaction'), '/recurring-schedules?kind=transaction');
  const rows = useMemo(() => rowsQuery.data?.items ?? [], [rowsQuery.data]);
  const total = rowsQuery.data?.total ?? 0;
  const summary = summaryQuery.data ?? null;
  const trend = trendQuery.data ?? [];
  const recurring = recurringQuery.data ?? [];
  const error = (rowsQuery.error ?? summaryQuery.error)?.message ?? null;
  // 자산이동 거래가 예적금/투자/자산 잔액을 바꿀 수 있어 해당 탭도 함께 무효화
  const reload = () => invalidate(qk.transactions.all, qk.savings.all, qk.investments.all, qk.investmentAccounts.all, qk.assets.all);
  const reloadRecurring = () => invalidate(qk.recurringSchedules.all);

  async function handleToggleRecurring(id: number) {
    try {
      await api.patch(`/recurring-schedules/${id}/toggle`, {});
      reloadRecurring();
    } catch {
      notify.saveFailed();
    }
  }

  async function handleRemoveRecurring(id: number) {
    if (!await confirm('이 자동이체 설정을 삭제할까요? 이미 생성된 거래는 유지됩니다.', 'danger')) return;
    try {
      await api.del(`/recurring-schedules/${id}`);
      notify.deleted('자동이체 설정');
      reloadRecurring();
    } catch {
      notify.deleteFailed();
    }
  }

  async function handleRemove(id: number) {
    if (!await confirm('이 내역을 삭제할까요?', 'danger')) return;
    try {
      await api.del(`/transactions/${id}`);
      notify.deleted('내역');
      clear();
      reload();
    } catch {
      notify.deleteFailed();
    }
  }

  // 내역 복사 — 해당 데이터로 채운 추가 모달을 오늘 날짜로 열어 확인 후 저장
  function handleDuplicate(row: Transaction) {
    setModal({
      open: true, mode: 'add',
      prefill: {
        date: toDay(), title: row.title, amount: row.amount, type: row.type,
        category: row.category, payMethod: row.payMethod, memo: row.memo ?? undefined,
      },
    });
  }

  async function handleRemoveSelected() {
    if (selected.size === 0) return;
    if (!await confirm(`선택한 ${selected.size}건을 삭제할까요?`, 'danger')) return;
    try {
      await api.del('/transactions/bulk', { ids: [...selected] });
      notify.deleted(`${selected.size}건`);
      clear();
      reload();
    } catch {
      notify.deleteFailed();
    }
  }

  async function downloadTemplate() {
    try {
      await downloadTransactionTemplate(leafCats.map((c) => c.label));
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
      reload();
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
  const totalPages = Math.ceil(total / limit);
  const pagedRows = rows; // 서버가 이미 페이지 단위로 잘라서 보냄
  const { selected, toggle, toggleAll, clear, allChecked } = useRowSelection(pagedRows.map((r) => r.id));

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
            <CardTitle>🔁 자동이체 설정</CardTitle>
            <Button size="sm" variant="ghost" onClick={() => setRecurringModal({ open: true })}>+ 설정 추가</Button>
          </CardHeader>
          <CardBody compact>
            <div className="max-h-[264px] overflow-y-auto">
              {recurring.length === 0 && <div className="text-[0.72rem] text-muted">등록된 자동이체 설정이 없습니다.</div>}
              {recurring.map((r) => (
                <div className="py-2.5 border-b border-border-subtle last:border-b-0 flex items-center justify-between gap-2" key={r.id}>
                  <div className="min-w-0">
                    <div className="text-[0.84rem] font-medium flex items-center gap-1.5">
                      {r.title} — {won(r.amount ?? 0)}
                      {!r.active && <Badge tone="neutral">일시정지</Badge>}
                    </div>
                    <div className="text-[0.72rem] text-muted">
                      {catMap[r.category ?? ''] ?? r.category} · {r.txType && TX_TYPE_LABEL[r.txType]}
                      {' · '}{recurringRuleSummary(r.rule)}
                      {r.rule.weekendAdjust !== 'none' && ` · 주말→${WEEKEND_ADJUST_LABEL[r.rule.weekendAdjust]}`}
                      {r.nextRunDate && ` · 다음 ${dotDate(r.nextRunDate)}`}
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button size="sm" variant="ghost" onClick={() => handleToggleRecurring(r.id)}>{r.active ? '일시정지' : '재개'}</Button>
                    <Button size="sm" variant="ghost" onClick={() => setRecurringModal({ open: true, editing: r })}>수정</Button>
                    <Button size="sm" variant="danger" onClick={() => handleRemoveRecurring(r.id)}>삭제</Button>
                  </div>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      </div>

      <div className="flex flex-col md:flex-row md:items-center gap-3 mb-5 px-4 py-3 bg-surface border border-border rounded-(--radius)">
        <div className="flex flex-col gap-1.5 md:flex-row md:items-center md:gap-2">
          <span className="text-[0.75rem] font-semibold text-muted">엑셀</span>
          <div className="flex gap-2 flex-wrap">
            <button type="button" className="excel-btn" onClick={downloadTemplate}>양식 다운로드</button>
            <label className="excel-btn upload">
              엑셀 업로드
              <input type="file" accept=".xlsx,.xls,.csv" hidden aria-label="엑셀 업로드" onChange={handleUpload} />
            </label>
            <button type="button" className="excel-btn" onClick={downloadData}>데이터 다운로드</button>
          </div>
        </div>
      </div>

      <div className="bg-surface border border-border rounded-lg px-5 py-4 flex flex-col gap-3 mb-4">
        <div className="flex gap-2 items-center flex-wrap">
          {/* PC: shrink-0으로 날짜 묶음 고정, 모바일: flex-1로 가득 채워 프리셋이 다음 줄로 */}
          <div className="date-range-group flex items-center gap-2 shrink-0">
            <input type="date" className="input date-range-input w-35" value={pendingFrom} onChange={(ev) => { setPendingFrom(ev.target.value); setActivePreset(null); }} aria-label="조회 시작일" />
            <span className="text-muted text-[0.82rem] shrink-0 px-1">~</span>
            <input type="date" className="input date-range-input w-35" value={pendingTo} onChange={(ev) => { setPendingTo(ev.target.value); setActivePreset(null); }} aria-label="조회 종료일" />
          </div>
          <div className="flex gap-1">
            <Button size="sm" variant={activePreset === 1 ? 'primary' : 'ghost'} onClick={() => handleApplyPreset(1)}>1개월</Button>
            <Button size="sm" variant={activePreset === 2 ? 'primary' : 'ghost'} onClick={() => handleApplyPreset(2)}>2개월</Button>
            <Button size="sm" variant={activePreset === 3 ? 'primary' : 'ghost'} onClick={() => handleApplyPreset(3)}>3개월</Button>
          </div>
        </div>
        {/* 유형·카테고리·검색 한 줄 */}
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:flex-wrap">
          <div className="flex gap-2 md:contents">
            <select className="input flex-1 md:flex-none md:w-auto md:min-w-30 shrink-0" value={pendingType} onChange={(ev) => setPendingType(ev.target.value)} aria-label="유형 필터">
              <option value="">전체 유형</option>
              <option value="income">수입</option><option value="expense">지출</option><option value="transfer">자산이동</option>
            </select>
            <select className="input flex-1 md:flex-none md:w-auto md:min-w-30 shrink-0" value={pendingCat} onChange={(ev) => setPendingCat(ev.target.value)} aria-label="카테고리 필터">
              <option value="">전체 카테고리</option>
              {parentCats.map((p) => (
                <optgroup key={p.code} label={p.label}>
                  {leafCats.filter((l) => l.parentCode === p.code).map((c) => (
                    <option key={c.code} value={c.code}>{c.label}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
          <div className="flex gap-2 flex-1">
            <div className="relative flex-1 min-w-0">
              <IconSearch className="absolute left-2.75 top-1/2 -translate-y-1/2 text-muted w-3.75 h-3.75 pointer-events-none" />
              <input className="input pl-icon w-full" type="text" placeholder="내역 검색..." value={pendingQ} onChange={(ev) => setPendingQ(ev.target.value)} onKeyDown={(ev) => ev.key === 'Enter' && handleSearch()} aria-label="내역 검색" />
            </div>
            <Button onClick={handleSearch}>조회</Button>
          </div>
          <Button variant="ghost" className="w-full md:w-auto" onClick={handleReset}>초기화</Button>
        </div>
      </div>

      <div className="flex items-center justify-between mb-2">
        <span className="text-[0.78rem] text-secondary">총 {total}건</span>
        <div className="flex items-center gap-2">
          <Button variant="danger" disabled={selected.size === 0} onClick={handleRemoveSelected}>선택삭제</Button>
          <LimitSelect limit={limit} onLimitChange={changeLimit} />
        </div>
      </div>

      <div className={TABLE_CARD}>
        <div className="table-wrap max-md:hidden">
          <table>
            <colgroup>
              <col style={{ width: '40px' }} />
              <col style={{ width: '64px' }} />
              <col style={{ width: '88px' }} />
              <col style={{ width: '130px' }} />
              <col />
              <col style={{ width: '112px' }} />
              <col style={{ width: '132px' }} />
              <col style={{ width: '200px' }} />
              <col style={{ width: '96px' }} />
              <col style={{ width: '72px' }} />
            </colgroup>
            <thead>
              <tr>
                <th className="td-center"><input type="checkbox" className="checkbox" checked={allChecked} onChange={toggleAll} aria-label="전체선택" /></th>
                <th>번호</th><th>유형</th><th>카테고리</th><th>내역</th>
                <th>결제수단</th><th>금액</th><th>메모</th>
                <th>날짜</th><th>관리</th>
              </tr>
            </thead>
            <tbody>
              {pagedRows.length === 0 && <tr><td colSpan={10} className="td-center td-muted">내역이 없습니다.</td></tr>}
              {pagedRows.map((row, i) => (
                <tr key={row.id}>
                  <td className="td-center"><input type="checkbox" className="checkbox" checked={selected.has(row.id)} onChange={() => toggle(row.id)} aria-label="선택" /></td>
                  <td className="td-center td-muted">{total - (page - 1) * limit - i}</td>
                  <td className="td-center"><span className={`type-badge ${row.type}`}>{TX_TYPE_LABEL[row.type]}</span></td>
                  <td className="td-center"><span className="cat-chip">{catMap[row.category] ?? row.category}</span></td>
                  <td className="td-name">{row.recurringScheduleId != null && <span title="자동이체로 생성됨">🔁 </span>}{row.title}</td>
                  <td className="td-center td-muted">{row.payMethod}</td>
                  <td className={`td-right amount-${row.type}`}>{signedWon(row.type, row.amount)}</td>
                  <td className="td-center td-muted">{row.memo ?? '-'}</td>
                  <td className="td-center td-muted">{dotDate(row.date)}</td>
                  <td className="td-center"><RowActions onEdit={() => setModal({ open: true, mode: 'edit', editing: row })} onDelete={() => handleRemove(row.id)} onCopy={() => handleDuplicate(row)} /></td>
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
                <input type="checkbox" className="checkbox" checked={selected.has(row.id)} onChange={() => toggle(row.id)} aria-label="선택" />
                <div className="flex-1 flex justify-between items-baseline gap-2.5">
                  <span className={TXCARD_TITLE}>{row.recurringScheduleId != null && '🔁 '}{row.title}</span>
                  <span className={`${TXCARD_AMT} ${AMT_COLOR[row.type]}`}>{signedWon(row.type, row.amount)}</span>
                </div>
              </div>
              <div className="mt-2 pt-2 border-t border-border flex flex-col gap-1.5 text-[0.78rem]">
                {[
                  { label: '유형', value: <span className={`type-badge ${row.type}`}>{TX_TYPE_LABEL[row.type]}</span> },
                  { label: '카테고리', value: <span className="cat-chip">{catMap[row.category] ?? row.category}</span> },
                  ...(row.type === 'expense' ? [{ label: '결제수단', value: row.payMethod }] : []),
                  { label: '날짜', value: dotDate(row.date) },
                  ...(row.memo ? [{ label: '메모', value: row.memo }] : []),
                ].map(({ label, value }) => (
                  <div key={label} className="flex gap-2">
                    <span className="text-muted w-16 shrink-0">{label}</span>
                    <span>{value}</span>
                  </div>
                ))}
              </div>
              <CardActions onEdit={() => setModal({ open: true, mode: 'edit', editing: row })} onDelete={() => handleRemove(row.id)} onCopy={() => handleDuplicate(row)} />
            </div>
          ))}
        </div>
        <Pagination page={page} totalPages={totalPages} totalItems={total} onPageChange={setPage} />
      </div>

      <LedgerModal
        state={modal}
        categories={categories}
        bankCats={bankCats}
        onClose={() => setModal((s) => ({ ...s, open: false }))}
        onSaved={() => { setModal((s) => ({ ...s, open: false })); reload(); }}
      />
      <RecurringTransactionModal
        state={recurringModal}
        categories={categories}
        bankCats={bankCats}
        onClose={() => setRecurringModal((s) => ({ ...s, open: false }))}
        onSaved={() => { setRecurringModal((s) => ({ ...s, open: false })); reloadRecurring(); }}
      />
      {confirmElement}
    </>
  );
}

// 대분류 code → 거래 유형 (income/transfer 대분류만 해당 유형, 나머지는 지출)
function parentTypeOf(parentCode: string | null | undefined): TransactionType {
  if (parentCode === 'income') return 'income';
  if (parentCode === 'transfer') return 'transfer';
  return 'expense';
}

function LedgerModal({ state, categories, bankCats, onClose, onSaved }: { state: ModalState; categories: Category[]; bankCats: Category[]; onClose: () => void; onSaved: () => void }) {
  const e = state.editing;
  const parents = useMemo(() => categories.filter((c) => !c.parentCode), [categories]);
  const leaves = useMemo(() => categories.filter((c) => c.parentCode), [categories]);
  const [type, setType] = useState<TransactionType>('expense');
  const [date, setDate] = useState('');
  const [title, setTitle] = useState('');
  const [parentCode, setParentCode] = useState('');
  const [category, setCategory] = useState('');
  const [amount, setAmount] = useState('');
  const [payMethod, setPayMethod] = useState(PAY_METHODS[0]);
  const [memo, setMemo] = useState('');
  const [targetType, setTargetType] = useState<TransferTarget | ''>('');
  const [targetId, setTargetId] = useState<number | ''>('');
  const [targetDirection, setTargetDirection] = useState<TransferDirection>('decrease');
  const [saving, setSaving] = useState(false);
  const { errors, setErrors, clearError, reset } = useFormErrors();

  const targetPickerOpen = state.open && type === 'transfer';
  // 이동 대상 후보 — 자산이동일 때만 조회(연동 없이 단순 기록도 허용하므로 항상 강제하지 않음)
  const savingsQuery = useApiQuery<Saving[]>(qk.savings.list('transfer-target'), '/savings', { enabled: targetPickerOpen && targetType === 'saving' });
  // 투자는 종목(Investment)이 아니라 예수금을 보유한 투자 계좌(InvestmentAccount)가 자산이동 대상
  const investmentAccountsQuery = useApiQuery<InvestmentAccount[]>(qk.investmentAccounts.list('transfer-target'), '/investment-accounts', { enabled: targetPickerOpen && targetType === 'investment' });
  const assetsQuery = useApiQuery<Asset[]>(qk.assets.list('transfer-target'), '/assets', { enabled: targetPickerOpen && targetType === 'asset' });
  const targetItems: { id: number; label: string }[] = targetType === 'saving'
    ? (savingsQuery.data ?? []).map((s) => ({ id: s.id, label: `${s.bank} · ${s.name}` }))
    : targetType === 'investment'
      ? (investmentAccountsQuery.data ?? []).map((a) => ({ id: a.id, label: a.name }))
      : targetType === 'asset'
        ? (assetsQuery.data ?? []).map((a) => ({ id: a.id, label: a.name }))
        : [];

  useEffect(() => {
    if (!state.open) return;
    reset();
    const pf = state.prefill;
    // 소분류 code(leaf) 기준으로 대분류·유형을 일관되게 파생 (leaf 없으면 유형→첫 대분류→첫 소분류)
    const leafCode = e?.category ?? pf?.category;
    const leaf = leaves.find((l) => l.code === leafCode);
    const initType: TransactionType = leaf ? parentTypeOf(leaf.parentCode) : (e?.type ?? pf?.type ?? 'expense');
    const initParent = leaf?.parentCode ?? parents.find((p) => parentTypeOf(p.code) === initType)?.code ?? '';
    const initLeaf = leaf?.code ?? leaves.find((l) => l.parentCode === initParent)?.code ?? '';
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 모달 열릴 때 폼 초기화
    setType(initType);
    setDate(e?.date ?? pf?.date ?? new Date().toISOString().slice(0, 10));
    setTitle(e?.title ?? pf?.title ?? '');
    setParentCode(initParent);
    setCategory(initLeaf);
    setAmount(e ? String(e.amount) : pf?.amount ? String(pf.amount) : '');
    setPayMethod(e?.payMethod ?? pf?.payMethod ?? (initType === 'income' ? (bankCats[0]?.label ?? '') : initType === 'transfer' ? '' : PAY_METHODS[0]));
    setMemo(e?.memo ?? pf?.memo ?? '');
    setTargetType(e?.targetType ?? '');
    setTargetId(e?.targetId ?? '');
    setTargetDirection(e?.targetDirection ?? 'decrease');
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 모달 열림/수정대상 변경 시에만 폼 초기화
  }, [state.open, e]);

  function validate() {
    const err: Record<string, string> = {};
    if (!title.trim()) err.title = '내역을 입력하세요.';
    if (!amount || Number(amount) <= 0) err.amount = '금액을 입력하세요.';
    if (!date) err.date = '날짜를 선택하세요.';
    setErrors(err);
    return !Object.keys(err).length;
  }

  // 유형 변경 시 해당 유형의 첫 대분류·소분류 + 결제수단/은행 기본값으로 초기화 (지출↔수입↔이체 분리)
  function handleChangeType(t: TransactionType) {
    setType(t);
    const fp = parents.find((p) => parentTypeOf(p.code) === t);
    setParentCode(fp?.code ?? '');
    setCategory(leaves.find((l) => l.parentCode === fp?.code)?.code ?? '');
    // 지출=결제수단, 수입=입금은행, 이체=없음
    setPayMethod(t === 'expense' ? PAY_METHODS[0] : t === 'income' ? (bankCats[0]?.label ?? '') : '');
    if (t !== 'transfer') { setTargetType(''); setTargetId(''); }
  }

  // 이동 대상 종류 변경 시 항목 선택·방향 초기화 (목록이 바뀌므로)
  function handleChangeTargetType(tt: TransferTarget | '') {
    setTargetType(tt);
    setTargetId('');
    setTargetDirection('decrease');
  }

  // 대분류 변경 시 그 대분류의 첫 소분류로 설정
  function handleChangeParent(pc: string) {
    setParentCode(pc);
    setCategory(leaves.find((l) => l.parentCode === pc)?.code ?? '');
  }

  const availableParents = parents.filter((p) => parentTypeOf(p.code) === type);
  const childLeaves = leaves.filter((l) => l.parentCode === parentCode);

  async function handleSave() {
    if (!validate()) return;
    setSaving(true);
    try {
      const payload = {
        type, date, title, category, amount: Number(amount),
        // 지출=결제수단, 수입=입금은행 둘 다 저장, 이체는 없음
        payMethod: type === 'transfer' ? undefined : payMethod,
        memo: memo || undefined,
        targetType: type === 'transfer' && targetType && targetId !== '' ? targetType : undefined,
        targetId: type === 'transfer' && targetType && targetId !== '' ? targetId : undefined,
        targetDirection: type === 'transfer' && targetType === 'asset' && targetId !== '' ? targetDirection : undefined,
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
    <Modal open={state.open} onClose={onClose} title={state.mode === 'edit' ? '항목 수정' : '항목 추가'} footer={<ModalFooter onClose={onClose} onSave={handleSave} saving={saving} />}>
      <Field label="유형" required>
        <select className="input" value={type} onChange={(ev) => handleChangeType(ev.target.value as TransactionType)}>
          <option value="expense">지출</option><option value="income">수입</option><option value="transfer">자산이동</option>
        </select>
      </Field>
      <Field label="날짜" required error={errors.date}>
        <input type="date" className={`input${errors.date ? ' is-invalid' : ''}`} aria-label="날짜" value={date} onChange={(ev) => { setDate(ev.target.value); clearError('date'); }} />
      </Field>
      <Field label="내역" required error={errors.title}>
        <input type="text" className={`input${errors.title ? ' is-invalid' : ''}`} placeholder="예: 스타벅스" value={title} onChange={(ev) => { setTitle(ev.target.value); clearError('title'); }} />
      </Field>
      <div className="grid grid-cols-2 gap-4 max-md:grid-cols-1">
        <Field label="대분류" required>
          <select className="input" value={parentCode} onChange={(ev) => handleChangeParent(ev.target.value)}>
            {availableParents.map((p) => <option key={p.code} value={p.code}>{p.label}</option>)}
          </select>
        </Field>
        <Field label="소분류" required>
          <select className="input" value={category} onChange={(ev) => setCategory(ev.target.value)} disabled={childLeaves.length === 0}>
            {childLeaves.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
          </select>
        </Field>
      </div>
      <Field label="금액 (원)" required error={errors.amount}>
        <input type="number" className={`input${errors.amount ? ' is-invalid' : ''}`} placeholder="0" value={amount} onChange={(ev) => { setAmount(ev.target.value); clearError('amount'); }} />
      </Field>
      {type === 'transfer' && (
        <div className="grid grid-cols-2 gap-4 max-md:grid-cols-1">
          <Field label="이동 대상">
            <select className="input" value={targetType} onChange={(ev) => handleChangeTargetType(ev.target.value as TransferTarget | '')}>
              <option value="">연동 없음(단순 기록)</option>
              {(Object.entries(TRANSFER_TARGET_LABEL) as [TransferTarget, string][]).map(([v, label]) => (
                <option key={v} value={v}>{label}</option>
              ))}
            </select>
          </Field>
          <Field label="이동 대상 항목">
            <select className="input" value={targetId} onChange={(ev) => setTargetId(ev.target.value ? Number(ev.target.value) : '')} disabled={!targetType}>
              <option value="">선택 안 함</option>
              {targetItems.map((it) => <option key={it.id} value={it.id}>{it.label}</option>)}
            </select>
          </Field>
        </div>
      )}
      {type === 'transfer' && targetType === 'asset' && targetId !== '' && (
        <Field label="대상 변화 방향">
          <select className="input" value={targetDirection} onChange={(ev) => setTargetDirection(ev.target.value as TransferDirection)}>
            {(Object.entries(TRANSFER_DIRECTION_LABEL) as [TransferDirection, string][]).map(([v, label]) => (
              <option key={v} value={v}>{label}</option>
            ))}
          </select>
        </Field>
      )}
      {type === 'expense' && (
        <Field label="결제수단" required>
          <select className="input" aria-label="결제수단" value={payMethod} onChange={(ev) => setPayMethod(ev.target.value)}>
            {PAY_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </Field>
      )}
      {type === 'income' && (
        <Field label="입금 은행" required>
          <select className="input" aria-label="입금 은행" value={payMethod} onChange={(ev) => setPayMethod(ev.target.value)}>
            <option value="" disabled>은행 선택</option>
            {/* 기존 값이 목록에 없으면 그대로 노출 */}
            {payMethod && !bankCats.some((b) => b.label === payMethod) && <option value={payMethod}>{payMethod}</option>}
            {bankCats.map((b) => <option key={b.code} value={b.label}>{b.label}</option>)}
          </select>
        </Field>
      )}
      <Field label="메모 (선택)"><input type="text" className="input" placeholder="간단한 메모" value={memo} onChange={(ev) => setMemo(ev.target.value)} /></Field>
    </Modal>
  );
}

// 자동이체 설정 모달 — "데이터는 그냥 생성만" 원칙에 따라 거래 생성 모달과 완전히 분리된 반복 규칙 등록/수정 전용 모달.
// 저장 시 실제 거래는 만들지 않고 RecurringSchedule만 생성/수정 — 회차 생성은 크론이 규칙에 따라 처리한다.
function RecurringTransactionModal({ state, categories, bankCats, onClose, onSaved }: { state: RecurringModalState; categories: Category[]; bankCats: Category[]; onClose: () => void; onSaved: () => void }) {
  const r = state.editing;
  const parents = useMemo(() => categories.filter((c) => !c.parentCode), [categories]);
  const leaves = useMemo(() => categories.filter((c) => c.parentCode), [categories]);
  const [type, setType] = useState<TransactionType>('expense');
  const [startDate, setStartDate] = useState('');
  const [title, setTitle] = useState('');
  const [parentCode, setParentCode] = useState('');
  const [category, setCategory] = useState('');
  const [amount, setAmount] = useState('');
  const [payMethod, setPayMethod] = useState(PAY_METHODS[0]);
  const [memo, setMemo] = useState('');
  const [active, setActive] = useState(true);
  const [recurringCycle, setRecurringCycle] = useState<RecurringCycle>('monthly');
  const [recurringDay, setRecurringDay] = useState(1);
  const [recurringMonth, setRecurringMonth] = useState(1);
  const [weekendAdjust, setWeekendAdjust] = useState<WeekendAdjust>('none');
  const [targetType, setTargetType] = useState<TransferTarget | ''>('');
  const [targetId, setTargetId] = useState<number | ''>('');
  const [targetDirection, setTargetDirection] = useState<TransferDirection>('decrease');
  const [saving, setSaving] = useState(false);
  const { errors, setErrors, clearError, reset } = useFormErrors();

  const targetPickerOpen = state.open && type === 'transfer';
  const savingsQuery = useApiQuery<Saving[]>(qk.savings.list('transfer-target'), '/savings', { enabled: targetPickerOpen && targetType === 'saving' });
  const investmentAccountsQuery = useApiQuery<InvestmentAccount[]>(qk.investmentAccounts.list('transfer-target'), '/investment-accounts', { enabled: targetPickerOpen && targetType === 'investment' });
  const assetsQuery = useApiQuery<Asset[]>(qk.assets.list('transfer-target'), '/assets', { enabled: targetPickerOpen && targetType === 'asset' });
  const targetItems: { id: number; label: string }[] = targetType === 'saving'
    ? (savingsQuery.data ?? []).map((s) => ({ id: s.id, label: `${s.bank} · ${s.name}` }))
    : targetType === 'investment'
      ? (investmentAccountsQuery.data ?? []).map((a) => ({ id: a.id, label: a.name }))
      : targetType === 'asset'
        ? (assetsQuery.data ?? []).map((a) => ({ id: a.id, label: a.name }))
        : [];

  useEffect(() => {
    if (!state.open) return;
    reset();
    const leafCode = r?.category ?? undefined;
    const leaf = leaves.find((l) => l.code === leafCode);
    const initType: TransactionType = leaf ? parentTypeOf(leaf.parentCode) : (r?.txType ?? 'expense');
    const initParent = leaf?.parentCode ?? parents.find((p) => parentTypeOf(p.code) === initType)?.code ?? '';
    const initLeaf = leaf?.code ?? leaves.find((l) => l.parentCode === initParent)?.code ?? '';
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 모달 열릴 때 폼 초기화
    setType(initType);
    setStartDate(r?.startDate ?? new Date().toISOString().slice(0, 10));
    setTitle(r?.title ?? '');
    setParentCode(initParent);
    setCategory(initLeaf);
    setAmount(r?.amount != null ? String(r.amount) : '');
    setPayMethod(r?.payMethod ?? (initType === 'income' ? (bankCats[0]?.label ?? '') : initType === 'transfer' ? '' : PAY_METHODS[0]));
    setMemo(r?.memo ?? '');
    setActive(r?.active ?? true);
    setRecurringCycle(r?.rule?.cycle ?? 'monthly');
    setRecurringDay(r?.rule?.day ?? 1);
    setRecurringMonth(r?.rule?.month ?? 1);
    setWeekendAdjust(r?.rule?.weekendAdjust ?? 'none');
    setTargetType(r?.targetType ?? '');
    setTargetId(r?.targetId ?? '');
    setTargetDirection(r?.targetDirection ?? 'decrease');
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 모달 열림/수정대상 변경 시에만 폼 초기화
  }, [state.open, r]);

  function validate() {
    const err: Record<string, string> = {};
    if (!title.trim()) err.title = '내역을 입력하세요.';
    if (!amount || Number(amount) <= 0) err.amount = '금액을 입력하세요.';
    if (!startDate) err.startDate = '시작일을 선택하세요.';
    setErrors(err);
    return !Object.keys(err).length;
  }

  function handleChangeType(t: TransactionType) {
    setType(t);
    const fp = parents.find((p) => parentTypeOf(p.code) === t);
    setParentCode(fp?.code ?? '');
    setCategory(leaves.find((l) => l.parentCode === fp?.code)?.code ?? '');
    setPayMethod(t === 'expense' ? PAY_METHODS[0] : t === 'income' ? (bankCats[0]?.label ?? '') : '');
    if (t !== 'transfer') { setTargetType(''); setTargetId(''); }
  }

  function handleChangeTargetType(tt: TransferTarget | '') {
    setTargetType(tt);
    setTargetId('');
    setTargetDirection('decrease');
  }

  function handleChangeParent(pc: string) {
    setParentCode(pc);
    setCategory(leaves.find((l) => l.parentCode === pc)?.code ?? '');
  }

  const availableParents = parents.filter((p) => parentTypeOf(p.code) === type);
  const childLeaves = leaves.filter((l) => l.parentCode === parentCode);

  async function handleSave() {
    if (!validate()) return;
    setSaving(true);
    try {
      const payload = {
        kind: 'transaction' as const,
        startDate,
        active,
        rule: { cycle: recurringCycle, day: recurringDay, month: recurringCycle === 'yearly' ? recurringMonth : undefined, weekendAdjust },
        txType: type,
        title,
        category,
        amount: Number(amount),
        payMethod: type === 'transfer' ? undefined : payMethod,
        memo: memo || undefined,
        targetType: type === 'transfer' && targetType && targetId !== '' ? targetType : undefined,
        targetId: type === 'transfer' && targetType && targetId !== '' ? targetId : undefined,
        targetDirection: type === 'transfer' && targetType === 'asset' && targetId !== '' ? targetDirection : undefined,
      };
      if (r) await api.put(`/recurring-schedules/${r.id}`, payload);
      else await api.post('/recurring-schedules', payload);
      notify.upserted(r ? 'edit' : 'add', '자동이체 설정');
      onSaved();
    } catch {
      notify.saveFailed();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={state.open} onClose={onClose} title={r ? '자동이체 설정 수정' : '자동이체 설정 추가'} footer={<ModalFooter onClose={onClose} onSave={handleSave} saving={saving} />}>
      <Field label="유형" required>
        <select className="input" value={type} onChange={(ev) => handleChangeType(ev.target.value as TransactionType)}>
          <option value="expense">지출</option><option value="income">수입</option><option value="transfer">자산이동</option>
        </select>
      </Field>
      <Field label="내역" required error={errors.title}>
        <input type="text" className={`input${errors.title ? ' is-invalid' : ''}`} placeholder="예: 월세" value={title} onChange={(ev) => { setTitle(ev.target.value); clearError('title'); }} />
      </Field>
      <div className="grid grid-cols-2 gap-4 max-md:grid-cols-1">
        <Field label="대분류" required>
          <select className="input" value={parentCode} onChange={(ev) => handleChangeParent(ev.target.value)}>
            {availableParents.map((p) => <option key={p.code} value={p.code}>{p.label}</option>)}
          </select>
        </Field>
        <Field label="소분류" required>
          <select className="input" value={category} onChange={(ev) => setCategory(ev.target.value)} disabled={childLeaves.length === 0}>
            {childLeaves.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
          </select>
        </Field>
      </div>
      <Field label="금액 (원)" required error={errors.amount}>
        <input type="number" className={`input${errors.amount ? ' is-invalid' : ''}`} placeholder="0" value={amount} onChange={(ev) => { setAmount(ev.target.value); clearError('amount'); }} />
      </Field>
      {type === 'transfer' && (
        <div className="grid grid-cols-2 gap-4 max-md:grid-cols-1">
          <Field label="이동 대상">
            <select className="input" value={targetType} onChange={(ev) => handleChangeTargetType(ev.target.value as TransferTarget | '')}>
              <option value="">연동 없음(단순 기록)</option>
              {(Object.entries(TRANSFER_TARGET_LABEL) as [TransferTarget, string][]).map(([v, label]) => (
                <option key={v} value={v}>{label}</option>
              ))}
            </select>
          </Field>
          <Field label="이동 대상 항목">
            <select className="input" value={targetId} onChange={(ev) => setTargetId(ev.target.value ? Number(ev.target.value) : '')} disabled={!targetType}>
              <option value="">선택 안 함</option>
              {targetItems.map((it) => <option key={it.id} value={it.id}>{it.label}</option>)}
            </select>
          </Field>
        </div>
      )}
      {type === 'transfer' && targetType === 'asset' && targetId !== '' && (
        <Field label="대상 변화 방향">
          <select className="input" value={targetDirection} onChange={(ev) => setTargetDirection(ev.target.value as TransferDirection)}>
            {(Object.entries(TRANSFER_DIRECTION_LABEL) as [TransferDirection, string][]).map(([v, label]) => (
              <option key={v} value={v}>{label}</option>
            ))}
          </select>
        </Field>
      )}
      {type === 'expense' && (
        <Field label="결제수단" required>
          <select className="input" aria-label="결제수단" value={payMethod} onChange={(ev) => setPayMethod(ev.target.value)}>
            {PAY_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </Field>
      )}
      {type === 'income' && (
        <Field label="입금 은행" required>
          <select className="input" aria-label="입금 은행" value={payMethod} onChange={(ev) => setPayMethod(ev.target.value)}>
            <option value="" disabled>은행 선택</option>
            {payMethod && !bankCats.some((b) => b.label === payMethod) && <option value={payMethod}>{payMethod}</option>}
            {bankCats.map((b) => <option key={b.code} value={b.label}>{b.label}</option>)}
          </select>
        </Field>
      )}
      <Field label="메모 (선택)"><input type="text" className="input" placeholder="간단한 메모" value={memo} onChange={(ev) => setMemo(ev.target.value)} /></Field>

      <div className="flex flex-col gap-3 p-3.5 bg-surface border border-border rounded-(--radius)">
        <div className="grid grid-cols-2 gap-4 max-md:grid-cols-1">
          <Field label="시작일" required error={errors.startDate}>
            <input type="date" className={`input${errors.startDate ? ' is-invalid' : ''}`} value={startDate} onChange={(ev) => { setStartDate(ev.target.value); clearError('startDate'); }} />
          </Field>
          <Field label="반복 주기" required>
            <select className="input" value={recurringCycle} onChange={(ev) => setRecurringCycle(ev.target.value as RecurringCycle)}>
              <option value="daily">매일</option>
              <option value="monthly">매월</option>
              <option value="weekly">매주</option>
              <option value="yearly">매년</option>
            </select>
          </Field>
        </div>
        {recurringCycle === 'weekly' ? (
          <Field label="요일" required>
            <select className="input" value={recurringDay} onChange={(ev) => setRecurringDay(Number(ev.target.value))}>
              {WEEKDAY_LABEL.map((label, d) => <option key={d} value={d}>{label}요일</option>)}
            </select>
          </Field>
        ) : recurringCycle === 'daily' ? (
          <div className="text-[0.82rem] text-secondary">평일(월~금)에만 생성됩니다.</div>
        ) : (
          <Field label="기준일" required>
            <select className="input" value={recurringDay} onChange={(ev) => setRecurringDay(Number(ev.target.value))}>
              {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                <option key={d} value={d}>{d}일</option>
              ))}
            </select>
          </Field>
        )}
        {recurringCycle === 'yearly' && (
          <Field label="월" required>
            <select className="input" value={recurringMonth} onChange={(ev) => setRecurringMonth(Number(ev.target.value))}>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => <option key={m} value={m}>{m}월</option>)}
            </select>
          </Field>
        )}
        {recurringCycle !== 'weekly' && recurringCycle !== 'daily' && (
          <Field label="주말인 경우">
            <div className="flex gap-5 flex-wrap [&_label]:flex [&_label]:items-center [&_label]:gap-1.25 [&_label]:text-[0.82rem] [&_label]:text-secondary [&_label]:cursor-pointer [&_input]:accent-accent">
              <label><input type="radio" name="recurringWeekendAdjust" value="none" checked={weekendAdjust === 'none'} onChange={() => setWeekendAdjust('none')} />조정 안 함</label>
              <label><input type="radio" name="recurringWeekendAdjust" value="before" checked={weekendAdjust === 'before'} onChange={() => setWeekendAdjust('before')} />전 금요일</label>
              <label><input type="radio" name="recurringWeekendAdjust" value="after" checked={weekendAdjust === 'after'} onChange={() => setWeekendAdjust('after')} />다음 월요일</label>
            </div>
          </Field>
        )}
        <label className="flex items-center gap-2 text-[0.875rem] font-medium text-primary cursor-pointer select-none [&_input]:w-4 [&_input]:h-4 [&_input]:accent-accent [&_input]:cursor-pointer">
          <input type="checkbox" checked={active} onChange={(ev) => setActive(ev.target.checked)} />
          활성 (일시정지하면 새 회차를 생성하지 않음)
        </label>
      </div>
    </Modal>
  );
}
