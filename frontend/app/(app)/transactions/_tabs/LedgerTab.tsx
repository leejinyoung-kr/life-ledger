'use client';

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import {
  DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useSearchParams } from 'next/navigation';
import StatCard, { StatStrip } from '@/components/StatCard';
import BarChart from '@/components/BarChart';
import Modal from '@/components/Modal';
import Pagination, { LimitSelect } from '@/components/Pagination';
import Button from '@/components/ui/Button';
import IconButton from '@/components/ui/IconButton';
import MoreMenu from '@/components/ui/MoreMenu';
import Segmented, { type SegmentedItem } from '@/components/ui/Segmented';
import SearchInput from '@/components/ui/SearchInput';
import Badge from '@/components/ui/Badge';
import Toggle from '@/components/ui/Toggle';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card';
import { Field, FieldGroup, FormGroup, ModalFooter } from '@/components/ui/Field';
import { useConfirm } from '@/components/ConfirmModal';
import {
  IconWon, IconChart, IconStar, IconTransfer, IconInfo, IconPlus, IconEdit, IconCopy, IconTrash,
  IconRepeat, IconPause, IconPlay, IconDrag, IconCreditCard,
} from '@/components/icons';
import { notify } from '@/lib/toast';
import { api } from '@/lib/api';
import { useApiQuery, useInvalidate, type Paginated } from '@/lib/query';
import { useFormErrors } from '@/lib/useFormErrors';
import { qk } from '@/lib/queryKeys';
import { downloadTransactionTemplate } from '@/lib/excel';
import { usePagination } from '@/lib/usePagination';
import { useRowSelection } from '@/lib/useRowSelection';
import EmptyState from '@/components/EmptyState';
import MobileCard, { MobileCardList } from '@/components/MobileCard';
import ErrorBanner from '@/components/ErrorBanner';
import TableEmptyRow from '@/components/TableEmptyRow';
import FilterPanel from '@/components/FilterPanel';
import ExcelToolbar from '@/components/ExcelToolbar';
import ListToolbar from '@/components/ListToolbar';
import {
  TX_TYPE_LABEL, WEEKEND_ADJUST_LABEL, TRANSFER_TARGET_LABEL, recurringRuleSummary, WEEKDAY_LABEL,
  won, dotDate, localDate,
  activeWith, categoryOptions,
  type Category, type Transaction, type TransactionFavorite, type TransactionSummary, type TrendBucket,
  type TransactionType, type RecurringCycle, type WeekendAdjust, type TransferTarget,
  type Saving, type InvestmentAccount, type RecurringSchedule,
} from '@/lib/finance';
import { AMT_COLOR, toDay, monthsAgo, useAddTrigger, ruleDayFor } from '../_shared';

// prefill: 내역 복사(handleDuplicate) 등으로 추가 모달을 미리 채울 때 사용
type LedgerDraft = {
  date?: string; title?: string; amount?: number;
  type?: TransactionType; category?: string; payMethod?: string; memo?: string;
  targetType?: TransferTarget; targetId?: number;
};
type ModalState = { open: boolean; mode: 'add' | 'edit'; editing?: Transaction; prefill?: LedgerDraft };

// 자동으로 만든 내역 표시 — 자동이체 회차는 반복, 구독 자동 등록은 카드 아이콘
function AutoSourceIcon({ row }: { row: Transaction }) {
  if (row.recurringScheduleId != null) return <IconRepeat width={13} height={13} className="shrink-0 text-muted" aria-label="자동이체로 생성됨" />;
  if (row.subscriptionId != null) return <IconCreditCard width={13} height={13} className="shrink-0 text-muted" aria-label="구독에서 자동 등록됨" />;
  return null;
}
type RecurringModalState = { open: boolean; editing?: RecurringSchedule };

export default function LedgerTab({ categories, bankCats, payMethodCats, addTrigger }: { categories: Category[]; bankCats: Category[]; payMethodCats: Category[]; addTrigger: number }) {
  // 통합 검색에서 온 경우(?q=&date=&focus=) — 그날 · 그 내역으로 거른 목록으로 시작하고, 그 줄의 수정 창을 연다
  const searchParams = useSearchParams();
  const [focus] = useState(() => {
    const date = searchParams.get('date') ?? '';
    const id = Number(searchParams.get('focus'));
    return /^\d{4}-\d{2}-\d{2}$/.test(date) && id ? { id, date, q: searchParams.get('q') ?? '' } : null;
  });
  const [pendingFrom, setPendingFrom] = useState(() => focus?.date ?? monthsAgo(1));
  const [pendingTo, setPendingTo] = useState(() => focus?.date ?? toDay());
  const [pendingType, setPendingType] = useState('');
  const [pendingCat, setPendingCat] = useState('');
  const [pendingQ, setPendingQ] = useState(() => focus?.q ?? '');
  const [applied, setApplied] = useState(() => (focus
    ? { from: focus.date, to: focus.date, type: '', cat: '', q: focus.q }
    : { from: monthsAgo(1), to: toDay(), type: '', cat: '', q: '' }));
  const { page, setPage, limit, changeLimit } = usePagination();
  const { confirm, confirmElement } = useConfirm();
  const [activePreset, setActivePreset] = useState<number | null>(focus ? null : 1);
  const [modal, setModal] = useState<ModalState>({ open: false, mode: 'add' });
  const [recurringModal, setRecurringModal] = useState<RecurringModalState>({ open: false });
  const invalidate = useInvalidate();

  useAddTrigger(addTrigger, () => setModal({ open: true, mode: 'add' }));

  // 목록은 비활성 포함 전체 — 표시(코드 → 라벨)는 전체로 해야 비활성 항목이 붙은 기존 기록도 라벨로 보인다
  const catMap = Object.fromEntries(categories.map((c) => [c.code, c.label]));
  const payMethodMap = Object.fromEntries(payMethodCats.map((c) => [c.code, c.label]));
  const bankMap = Object.fromEntries(bankCats.map((c) => [c.code, c.label]));
  // 2계층: 대분류(parentCode 없음) / 소분류(parentCode 있음) 분리 — 필터 · 엑셀 양식은 사용 중인 것만
  const parentCats = useMemo(() => categories.filter((c) => c.isActive && !c.parentCode), [categories]);
  const leafCats = useMemo(() => categories.filter((c) => c.isActive && c.parentCode), [categories]);

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

  const rowsQuery = useApiQuery<Paginated<Transaction> & { sumIncome: number; sumExpense: number; sumTransfer: number }>(qk.transactions.list({ ...applied, page, limit }), `/transactions?${listQs}`);
  const summaryQuery = useApiQuery<TransactionSummary>(qk.transactions.summary(month), `/transactions/summary?month=${month}`);
  const trendQuery = useApiQuery<TrendBucket[]>(qk.transactions.monthlyTrend(month), `/transactions/monthly-trend?month=${month}`);
  const recurringQuery = useApiQuery<RecurringSchedule[]>(qk.recurringSchedules.list('transaction'), '/recurring-schedules?kind=transaction');
  const rows = useMemo(() => rowsQuery.data?.items ?? [], [rowsQuery.data]);
  const total = rowsQuery.data?.total ?? 0;

  // 검색에서 고른 내역이 목록에 오면 수정 창을 한 번 열고, 새로고침해도 다시 열리지 않게 주소의 검색 조건을 지운다
  const [focusDone, setFocusDone] = useState(false);
  useEffect(() => {
    if (!focus || focusDone || !rowsQuery.data) return;
    const row = rows.find((r) => r.id === focus.id);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 목록이 도착한 뒤 한 번만 여는 동작
    if (row) setModal({ open: true, mode: 'edit', editing: row });
    setFocusDone(true);
    window.history.replaceState(null, '', '/transactions');
  }, [focus, focusDone, rows, rowsQuery.data]);
  const sumIncome = rowsQuery.data?.sumIncome ?? 0;
  const sumExpense = rowsQuery.data?.sumExpense ?? 0;
  const summary = summaryQuery.data ?? null;
  const trend = trendQuery.data ?? [];
  const recurring = recurringQuery.data ?? [];
  const error = (rowsQuery.error ?? summaryQuery.error)?.message ?? null;
  // 자산이동 거래가 예적금/투자 잔액을 바꿀 수 있어 해당 탭도 함께 무효화
  const reload = () => invalidate(qk.transactions.all, qk.savings.all, qk.investments.all, qk.investmentAccounts.all);
  const reloadRecurring = () => invalidate(qk.recurringSchedules.all);

  // 즐겨찾기 — 즐겨찾기 줄·관리 창에서 직접 등록/수정한다 (내역 행에서 등록하지 않음)
  const favoritesQuery = useApiQuery<TransactionFavorite[]>(qk.transactionFavorites.list(), '/transaction-favorites');
  const favorites = useMemo(() => favoritesQuery.data ?? [], [favoritesQuery.data]);
  const [favManageOpen, setFavManageOpen] = useState(false);
  const [favForm, setFavForm] = useState<FavoriteFormState>({ open: false });
  const reloadFavorites = () => invalidate(qk.transactionFavorites.all);

  // 즐겨찾기 사용 — 저장된 내용으로 채운 추가 모달을 오늘 날짜로 연다 (금액만 바꿔 저장하는 흐름)
  function handleUseFavorite(f: TransactionFavorite) {
    setModal({
      open: true, mode: 'add',
      prefill: {
        date: toDay(), title: f.title, amount: f.amount, type: f.type,
        category: f.category, payMethod: f.payMethod, memo: f.memo ?? undefined,
      },
    });
  }

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
        targetType: row.targetType ?? undefined, targetId: row.targetId ?? undefined,
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
      await downloadTransactionTemplate(leafCats.map((c) => c.label), payMethodCats.filter((c) => c.isActive).map((c) => c.label));
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

  const totalPages = Math.ceil(total / limit);
  const pagedRows = rows; // 서버가 이미 페이지 단위로 잘라서 보냄
  const { selected, toggle, toggleAll, clear, allChecked } = useRowSelection(pagedRows.map((r) => r.id));

  // 결제수단 칸 — 지출은 결제수단, 수입은 입금 은행 이름으로 바꿔 보여준다 (자산이동은 저장된 값 그대로)
  function payLabel(row: Transaction): string {
    if (row.type === 'expense') return payMethodMap[row.payMethod] ?? row.payMethod;
    if (row.type === 'income') return bankMap[row.payMethod] ?? row.payMethod;
    return row.payMethod;
  }

  return (
    <>
      <ErrorBanner message={error} />

      {/* 즐겨찾기 줄 — 왼쪽 이름 · 가운데 항목(누르면 오늘 날짜로 추가 창) · 오른쪽 끝 등록 · 관리.
          휴대폰은 이름 · 등록 · 관리를 윗줄에 두고 항목을 아랫줄 전체 폭으로 내린다 (order 로 자리만 바꾼다) */}
      <Card className="mb-6 px-4 py-3 flex items-center gap-x-3 gap-y-2.5 flex-wrap">
        <span className="flex items-center gap-1.5 md:pr-3 md:border-r border-border-subtle text-[0.84rem] font-semibold text-primary shrink-0">
          <IconStar width={15} height={15} className="text-accent" />즐겨찾기
        </span>
        <div className="order-last md:order-0 basis-full md:basis-0 md:flex-1 min-w-0 flex items-center gap-1.5 flex-wrap">
          {favorites.length === 0 && (
            <span className="text-[0.78rem] text-muted break-keep">자주 쓰는 수입 · 지출을 등록하면, 누를 때마다 오늘 날짜로 채운 추가 창이 열립니다.</span>
          )}
          {favorites.map((f) => (
            <Button key={f.id} size="sm" variant="ghost" onClick={() => handleUseFavorite(f)} title={`${catMap[f.category] ?? f.category} · 누르면 오늘 날짜로 추가`}>
              {f.title}<span className={`amount-${f.type} text-[0.75rem] font-normal`}>{ledgerAmount(f.type, f.amount)}</span>
            </Button>
          ))}
        </div>
        <div className="flex items-center gap-1.5 shrink-0 ml-auto">
          <Button size="sm" variant="ghost" onClick={() => setFavForm({ open: true })}><IconPlus />등록</Button>
          {favorites.length > 0 && <Button size="sm" variant="ghost" onClick={() => setFavManageOpen(true)}>관리</Button>}
        </div>
      </Card>

      {summary && (
        <StatStrip>
          <StatCard icon={<IconWon />} tone="green" value={won(summary.income)} valueTone="in" label="수입" change="이번 달 합계" />
          <StatCard icon={<IconWon />} tone="red" value={won(summary.expense)} valueTone="out" label="지출" change="이번 달 합계" />
          <StatCard icon={<IconTransfer />} tone="blue" value={won(summary.transfer)} valueTone="move" label="자산이동" change="예적금 · 투자로 옮긴 돈" />
          <StatCard icon={<IconChart />} tone="amber" value={won(summary.balance)} valueTone={summary.balance < 0 ? 'out' : undefined} label="잔액" change="수입 − 지출 − 자산이동" />
        </StatStrip>
      )}

      <p className="flex items-center gap-1.5 text-[0.75rem] text-muted mb-6">
        <IconInfo width={13} height={13} className="shrink-0" />
        <span><span className="text-blue">자산이동</span>은 예적금 · 투자 계좌로 옮긴 돈이라 지출에는 들지 않고, 잔액에서는 빠집니다.</span>
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* 두 칸일 때는 옆 자동이체 카드 높이만큼 늘어나므로 차트가 남는 높이를 채운다. 한 칸(휴대폰)은 200px */}
        <Card className="flex flex-col">
          <CardHeader><CardTitle>월별 지출 추이</CardTitle></CardHeader>
          <CardBody className="h-[200px] md:h-auto md:flex-1 md:min-h-45">
            <BarChart
              label="월별 지출 추이"
              tone="out"
              height="fill"
              items={trend.map((b) => {
                const isCurrent = b.month === applied.to.slice(0, 7);
                return { key: b.month, label: b.label, value: b.total, valueLabel: isCurrent ? won(b.total) : undefined, current: isCurrent };
              })}
            />
          </CardBody>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>자동이체 설정</CardTitle>
            <Button size="sm" variant="ghost" onClick={() => setRecurringModal({ open: true })}><IconPlus />설정 추가</Button>
          </CardHeader>
          <div className="md:max-h-66 md:overflow-y-auto">
            {recurring.length === 0 && <EmptyState size="sm" message="등록된 자동이체 설정이 없습니다." />}
            {recurring.map((r) => (
              <RecurringRow
                key={r.id}
                r={r}
                catLabel={catMap[r.category ?? ''] ?? r.category}
                onToggle={() => handleToggleRecurring(r.id)}
                onEdit={() => setRecurringModal({ open: true, editing: r })}
                onDelete={() => handleRemoveRecurring(r.id)}
              />
            ))}
          </div>
        </Card>
      </div>

      <div className="pb-2.5"><CardTitle>내역</CardTitle></div>

      <FilterPanel className="mb-0">
        <div className="flex gap-2 items-center flex-wrap">
          {/* PC: shrink-0으로 날짜 묶음 고정, 모바일: flex-1로 가득 채워 프리셋이 다음 줄로 */}
          <div className="date-range-group flex items-center gap-2 shrink-0">
            <input type="date" className="input date-range-input w-35" value={pendingFrom} onChange={(ev) => { setPendingFrom(ev.target.value); setActivePreset(null); }} aria-label="조회 시작일" />
            <span className="text-muted text-[0.82rem] shrink-0 px-1">~</span>
            <input type="date" className="input date-range-input w-35" value={pendingTo} onChange={(ev) => { setPendingTo(ev.target.value); setActivePreset(null); }} aria-label="조회 종료일" />
          </div>
          <Segmented
            label="조회 기간"
            variant="joined"
            items={PRESET_ITEMS}
            value={activePreset ? String(activePreset) : ''}
            onChange={(v) => handleApplyPreset(Number(v))}
          />
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
            <SearchInput label="내역 검색" className="flex-1 min-w-0" placeholder="내역 검색" value={pendingQ} onChange={(ev) => setPendingQ(ev.target.value)} onEnter={handleSearch} />
            <Button onClick={handleSearch}>조회</Button>
          </div>
          <Button variant="ghost" className="w-full md:w-auto" onClick={handleReset}>초기화</Button>
        </div>
      </FilterPanel>

      <ListToolbar
        total={total}
        summary={<><span className="amount-income">수입 +{won(sumIncome)}</span><span className="amount-expense">지출 −{won(sumExpense)}</span></>}
        tools={<ExcelToolbar onDownloadTemplate={downloadTemplate} onUpload={handleUpload} onDownloadData={downloadData} accept=".xlsx,.xls,.csv" />}
      >
        <Button variant="danger" size="sm" disabled={selected.size === 0} onClick={handleRemoveSelected}>선택삭제</Button>
        <LimitSelect limit={limit} onLimitChange={changeLimit} />
      </ListToolbar>

      <div className="table-wrap max-md:hidden mt-3">
        <table>
          <colgroup>
            <col style={{ width: '40px' }} />
            <col style={{ width: '104px' }} />
            <col style={{ width: '80px' }} />
            <col />
            <col style={{ width: '140px' }} />
            <col style={{ width: '120px' }} />
            <col style={{ width: '136px' }} />
            <col style={{ width: '112px' }} />
          </colgroup>
          <thead>
            <tr>
              <th className="td-center"><input type="checkbox" className="checkbox" checked={allChecked} onChange={toggleAll} aria-label="전체선택" /></th>
              <th className="th-left">날짜</th><th className="th-left">유형</th><th className="th-left">내역</th>
              <th className="th-left">카테고리</th><th className="th-left">결제수단</th>
              <th className="td-right">금액 (원)</th><th className="td-right"><span className="sr-only">관리</span></th>
            </tr>
          </thead>
          <tbody>
            {pagedRows.length === 0 && <TableEmptyRow colSpan={8} message="내역이 없습니다." />}
            {pagedRows.map((row) => (
              <tr key={row.id} className="cursor-pointer" onClick={() => setModal({ open: true, mode: 'edit', editing: row })}>
                <td className="td-center" onClick={(ev) => ev.stopPropagation()}><input type="checkbox" className="checkbox" checked={selected.has(row.id)} onChange={() => toggle(row.id)} aria-label="선택" /></td>
                <td className="td-muted td-mono">{dotDate(row.date)}</td>
                {/* 유형은 부호(+ −) 대신 글자로 — 부호는 금액 칸에 이미 있어 겹치고, 글자가 한눈에 읽힌다 */}
                <td className={`amount-${row.type} text-[0.8125rem]`}>{TX_TYPE_LABEL[row.type]}</td>
                <td className="td-name">
                  <span className="flex items-center gap-1.5 min-w-0">
                    <span className="truncate">{row.title}</span>
                    <AutoSourceIcon row={row} />
                  </span>
                  {row.memo && <span className="block text-[0.75rem] text-muted truncate">{row.memo}</span>}
                </td>
                <td className="text-muted">{catMap[row.category] ?? row.category}</td>
                <td className="text-muted">{payLabel(row)}</td>
                <td className={`td-right amount-${row.type}`}>{ledgerAmount(row.type, row.amount)}</td>
                <td onClick={(ev) => ev.stopPropagation()}>
                  <EntryActions onEdit={() => setModal({ open: true, mode: 'edit', editing: row })} onCopy={() => handleDuplicate(row)} onDelete={() => handleRemove(row.id)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <MobileCardList empty={pagedRows.length === 0 && '내역이 없습니다.'} selection={{ all: allChecked, count: selected.size, onToggleAll: toggleAll }}>
        {pagedRows.map((row) => (
          <MobileCard
            key={row.id}
            checked={selected.has(row.id)}
            onCheck={() => toggle(row.id)}
            title={
              <span className="flex items-center gap-1.5">
                {row.title}
                <AutoSourceIcon row={row} />
              </span>
            }
            aside={<span className={`text-[0.95rem] font-semibold tabular-nums ${AMT_COLOR[row.type]}`}>{ledgerAmount(row.type, row.amount)}</span>}
            fields={[
              { label: '유형', value: <span className={`amount-${row.type}`}>{TX_TYPE_LABEL[row.type]}</span> },
              { label: '카테고리', value: catMap[row.category] ?? row.category },
              { label: '결제수단', value: payLabel(row) },
              { label: '날짜', value: dotDate(row.date) },
              { label: '메모', value: row.memo },
            ]}
            actions={[
              { label: '복사', onClick: () => handleDuplicate(row) },
              { label: '수정', onClick: () => setModal({ open: true, mode: 'edit', editing: row }) },
              { label: '삭제', danger: true, onClick: () => handleRemove(row.id) },
            ]}
          />
        ))}
      </MobileCardList>
      <Pagination page={page} totalPages={totalPages} totalItems={total} onPageChange={setPage} />

      <LedgerModal
        state={modal}
        categories={categories}
        bankCats={bankCats}
        payMethodCats={payMethodCats}
        onClose={() => setModal((s) => ({ ...s, open: false }))}
        onSaved={() => { setModal((s) => ({ ...s, open: false })); reload(); }}
      />
      <RecurringTransactionModal
        state={recurringModal}
        categories={categories}
        bankCats={bankCats}
        payMethodCats={payMethodCats}
        onClose={() => setRecurringModal((s) => ({ ...s, open: false }))}
        onSaved={() => { setRecurringModal((s) => ({ ...s, open: false })); reloadRecurring(); }}
      />
      <FavoriteManageModal
        open={favManageOpen}
        favorites={favorites}
        catMap={catMap}
        onClose={() => setFavManageOpen(false)}
        onChanged={reloadFavorites}
        onAdd={() => { setFavManageOpen(false); setFavForm({ open: true, fromManage: true }); }}
        onEdit={(f) => { setFavManageOpen(false); setFavForm({ open: true, editing: f, fromManage: true }); }}
      />
      <FavoriteFormModal
        state={favForm}
        categories={categories}
        bankCats={bankCats}
        payMethodCats={payMethodCats}
        onClose={() => { setFavForm((s) => ({ ...s, open: false })); if (favForm.fromManage) setFavManageOpen(true); }}
        onSaved={() => { setFavForm((s) => ({ ...s, open: false })); reloadFavorites(); if (favForm.fromManage) setFavManageOpen(true); }}
      />
      {confirmElement}
    </>
  );
}

// 금액 앞 유형 부호 — 수입 + · 지출 − · 자산이동 ⇄ (돈 색과 함께 쓴다)
const TYPE_SIGN: Record<TransactionType, string> = { income: '+', expense: '−', transfer: '⇄' };

// 금액에 유형 부호를 붙여 보여준다
function ledgerAmount(type: TransactionType, n: number): string {
  return `${TYPE_SIGN[type]}${won(Math.abs(n))}`;
}

const PRESET_ITEMS: SegmentedItem<string>[] = [
  { value: '1', label: '1개월' }, { value: '2', label: '2개월' }, { value: '3', label: '3개월' },
];
const TYPE_ITEMS: SegmentedItem<TransactionType>[] = [
  { value: 'expense', label: '지출' }, { value: 'income', label: '수입' }, { value: 'transfer', label: '자산이동' },
];
const FAV_TYPE_ITEMS: SegmentedItem<'income' | 'expense'>[] = [
  { value: 'expense', label: '지출' }, { value: 'income', label: '수입' },
];
const CYCLE_ITEMS: SegmentedItem<RecurringCycle>[] = [
  { value: 'daily', label: '매일' }, { value: 'weekly', label: '매주' }, { value: 'monthly', label: '매월' }, { value: 'yearly', label: '매년' },
];

// 표 한 줄의 관리 — 같은 지출을 다시 적는 복사를 메뉴에 숨기지 않고 바로 보인다
function EntryActions({ onEdit, onCopy, onDelete }: { onEdit: () => void; onCopy: () => void; onDelete: () => void }) {
  return (
    <div className="flex justify-end shrink-0">
      <IconButton label="복사" onClick={onCopy}><IconCopy /></IconButton>
      <IconButton label="수정" onClick={onEdit}><IconEdit /></IconButton>
      <IconButton label="삭제" variant="danger" onClick={onDelete}><IconTrash /></IconButton>
    </div>
  );
}

// 자동이체 설정 한 줄 — 데스크톱은 일시정지(재개) 하나 + 더보기, 휴대폰은 44px 더보기 하나로 접는다
function RecurringRow({ r, catLabel, onToggle, onEdit, onDelete }: { r: RecurringSchedule; catLabel?: string | null; onToggle: () => void; onEdit: () => void; onDelete: () => void }) {
  const t: TransactionType = r.txType ?? 'expense';
  const toggleLabel = r.active ? '일시정지' : '재개';
  const toggleIcon = r.active ? <IconPause /> : <IconPlay />;
  const editItem = { label: '수정', icon: <IconEdit />, onSelect: onEdit };
  const deleteItem = { label: '삭제', icon: <IconTrash />, onSelect: onDelete, danger: true };
  return (
    <div className={`flex items-center gap-3 py-2 pl-4.5 pr-2.5 border-b border-border-subtle last:border-b-0 ${r.active ? '' : 'opacity-70'}`}>
      <div className="flex-1 min-w-0 flex flex-col leading-snug">
        <span className="flex items-baseline gap-2 text-[0.84rem]">
          <span className="truncate">{r.title}</span>
          {!r.active && <Badge size="sm" tone="neutral">일시정지</Badge>}
        </span>
        <span className="text-[0.72rem] text-muted">
          {catLabel} · {recurringRuleSummary(r.rule)}
          {r.rule.weekendAdjust !== 'none' && ` · 주말→${WEEKEND_ADJUST_LABEL[r.rule.weekendAdjust]}`}
          {r.nextRunDate && ` · 다음 ${dotDate(r.nextRunDate)}`}
        </span>
      </div>
      <span className={`text-[0.84rem] whitespace-nowrap ${AMT_COLOR[t]}`}>{ledgerAmount(t, r.amount ?? 0)}</span>
      <div className="flex shrink-0">
        <div className="flex max-md:hidden">
          <IconButton label={toggleLabel} onClick={onToggle}>{toggleIcon}</IconButton>
          <MoreMenu items={[editItem, deleteItem]} />
        </div>
        <div className="md:hidden">
          <MoreMenu size="lg" items={[{ label: toggleLabel, icon: toggleIcon, onSelect: onToggle }, editItem, deleteItem]} />
        </div>
      </div>
    </div>
  );
}

// fromManage: 관리 창에서 연 경우 — 닫으면 관리 창으로 돌아간다
type FavoriteFormState = { open: boolean; editing?: TransactionFavorite; fromManage?: boolean };

// 즐겨찾기 등록/수정 — 날짜 없이 유형(수입·지출)·내역·카테고리·기본 금액·결제수단(입금 은행)·메모만 저장
function FavoriteFormModal({ state, categories, bankCats: allBanks, payMethodCats: allPays, onClose, onSaved }: { state: FavoriteFormState; categories: Category[]; bankCats: Category[]; payMethodCats: Category[]; onClose: () => void; onSaved: () => void }) {
  const e = state.editing;
  // 목록은 비활성 포함 전체 — 선택지는 사용 중인 것 + 기존 값
  const { parents, leaves } = useMemo(() => categoryOptions(categories, e?.category), [categories, e]);
  const bankCats = useMemo(() => activeWith(allBanks, e?.payMethod), [allBanks, e]);
  const payMethodCats = useMemo(() => activeWith(allPays, e?.payMethod), [allPays, e]);
  const [type, setType] = useState<'income' | 'expense'>('expense');
  const [title, setTitle] = useState('');
  const [parentCode, setParentCode] = useState('');
  const [category, setCategory] = useState('');
  const [amount, setAmount] = useState('');
  const [payMethod, setPayMethod] = useState('');
  const [memo, setMemo] = useState('');
  const [saving, setSaving] = useState(false);
  const { errors, setErrors, clearError, reset } = useFormErrors();

  useEffect(() => {
    if (!state.open) return;
    reset();
    // 수정이면 저장된 소분류에서 대분류를 파생, 등록이면 지출의 첫 대분류·소분류로 시작
    const leaf = leaves.find((l) => l.code === e?.category);
    const initType = e?.type ?? 'expense';
    const initParent = leaf?.parentCode ?? parents.find((p) => parentTypeOf(p.code) === initType)?.code ?? '';
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 모달 열릴 때 폼 초기화
    setType(initType);
    setTitle(e?.title ?? '');
    setParentCode(initParent);
    setCategory(leaf?.code ?? leaves.find((l) => l.parentCode === initParent)?.code ?? '');
    setAmount(e ? String(e.amount) : '');
    setPayMethod(e?.payMethod ?? (initType === 'income' ? (bankCats[0]?.code ?? '') : (payMethodCats[0]?.code ?? '')));
    setMemo(e?.memo ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 모달 열림/수정대상 변경 시에만 폼 초기화
  }, [state.open, e]);

  // 유형 변경 시 그 유형의 첫 대분류·소분류와 결제수단(지출)/입금 은행(수입) 기본값으로
  function handleChangeType(t: 'income' | 'expense') {
    setType(t);
    const fp = parents.find((p) => parentTypeOf(p.code) === t);
    setParentCode(fp?.code ?? '');
    setCategory(leaves.find((l) => l.parentCode === fp?.code)?.code ?? '');
    setPayMethod(t === 'income' ? (bankCats[0]?.code ?? '') : (payMethodCats[0]?.code ?? ''));
  }

  // 대분류 변경 시 그 대분류의 첫 소분류로
  function handleChangeParent(pc: string) {
    setParentCode(pc);
    setCategory(leaves.find((l) => l.parentCode === pc)?.code ?? '');
  }

  const availableParents = parents.filter((p) => parentTypeOf(p.code) === type);
  const childLeaves = leaves.filter((l) => l.parentCode === parentCode);
  const payOptions = type === 'income' ? bankCats : payMethodCats;

  async function handleSave() {
    const err: Record<string, string> = {};
    if (!title.trim()) err.title = '내역을 입력하세요.';
    if (!amount || Number(amount) <= 0) err.amount = '금액을 입력하세요.';
    setErrors(err);
    if (Object.keys(err).length) return;
    setSaving(true);
    try {
      const payload = { type, title: title.trim(), category, amount: Number(amount), payMethod, memo: memo || undefined };
      if (e) await api.put(`/transaction-favorites/${e.id}`, payload);
      else await api.post('/transaction-favorites', payload);
      notify.upserted(e ? 'edit' : 'add', '즐겨찾기');
      onSaved();
    } catch (ex) {
      notify.error((ex as Error).message || '저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={state.open} onClose={onClose} title={e ? '즐겨찾기 수정' : '즐겨찾기 등록'} footer={<ModalFooter onClose={onClose} onSave={handleSave} saving={saving} />}>
      <FieldGroup label="유형" required>
        <Segmented label="유형" variant="joined" className="w-full *:flex-1" items={FAV_TYPE_ITEMS} value={type} onChange={handleChangeType} />
      </FieldGroup>
      <Field label="내역" required error={errors.title}>
        <input type="text" className="input" aria-label="내역" placeholder="예: GS칼텍스 강남점" value={title} onChange={(ev) => { setTitle(ev.target.value); clearError('title'); }} />
      </Field>
      <div className="grid grid-cols-2 gap-4 max-md:grid-cols-1">
        <Field label="대분류" required>
          <select className="input" aria-label="대분류" value={parentCode} onChange={(ev) => handleChangeParent(ev.target.value)}>
            {availableParents.map((p) => <option key={p.code} value={p.code}>{p.label}</option>)}
          </select>
        </Field>
        <Field label="소분류" required>
          <select className="input" aria-label="소분류" value={category} onChange={(ev) => setCategory(ev.target.value)} disabled={childLeaves.length === 0}>
            {childLeaves.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
          </select>
        </Field>
      </div>
      <Field label="기본 금액 (원)" required error={errors.amount}>
        <input type="number" className="input" aria-label="기본 금액" placeholder="0" value={amount} onChange={(ev) => { setAmount(ev.target.value); clearError('amount'); }} />
      </Field>
      <Field label={type === 'income' ? '입금 은행' : '결제수단'} required>
        <select className="input" aria-label={type === 'income' ? '입금 은행' : '결제수단'} value={payMethod} onChange={(ev) => setPayMethod(ev.target.value)}>
          {/* 기존 값이 목록에 없으면 그대로 노출 */}
          {payMethod && !payOptions.some((m) => m.code === payMethod) && <option value={payMethod}>{payMethod}</option>}
          {payOptions.map((m) => <option key={m.code} value={m.code}>{m.label}</option>)}
        </select>
      </Field>
      <Field label="메모 (선택)"><input type="text" className="input" aria-label="메모" placeholder="간단한 메모" value={memo} onChange={(ev) => setMemo(ev.target.value)} /></Field>
      <p className="text-[0.72rem] text-muted">불러오면 오늘 날짜로 채운 추가 창이 열립니다. 금액은 그때 바꿀 수 있어요.</p>
    </Modal>
  );
}

// 즐겨찾기 관리 — 등록·수정·끌어서 순서 변경·삭제. 순서는 바로 저장하고, 삭제는 다른 삭제처럼 한 번 묻는다
function FavoriteManageModal({ open, favorites, catMap, onClose, onChanged, onAdd, onEdit }: { open: boolean; favorites: TransactionFavorite[]; catMap: Record<string, string>; onClose: () => void; onChanged: () => void; onAdd: () => void; onEdit: (f: TransactionFavorite) => void }) {
  const [busy, setBusy] = useState(false);
  const { confirm, confirmElement } = useConfirm();
  // 저장 중·재조회 전에 목록이 되돌아 보이지 않게, 바뀐 순서를 원본 목록(base)과 함께 들고 있는다
  const [pending, setPending] = useState<{ base: TransactionFavorite[]; list: TransactionFavorite[] } | null>(null);
  const list = pending && pending.base === favorites ? pending.list : favorites;
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = list.findIndex((f) => f.id === active.id);
    const to = list.findIndex((f) => f.id === over.id);
    if (from < 0 || to < 0) return;
    const next = arrayMove(list, from, to);
    setPending({ base: favorites, list: next });
    setBusy(true);
    try {
      await api.put('/transaction-favorites/order', { ids: next.map((f) => f.id) });
      onChanged();
    } catch {
      setPending(null);
      notify.saveFailed();
    } finally {
      setBusy(false);
    }
  }

  async function remove(f: TransactionFavorite) {
    if (!await confirm(`즐겨찾기 '${f.title}'을(를) 삭제할까요? 이미 기록한 내역은 그대로 둡니다.`, 'danger')) return;
    setBusy(true);
    try {
      await api.del(`/transaction-favorites/${f.id}`);
      notify.deleted('즐겨찾기');
      onChanged();
    } catch {
      notify.deleteFailed();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} title="즐겨찾기 관리" subtitle="손잡이를 끌어 순서를 바꿉니다." onClose={onClose} footer={<><Button variant="ghost" onClick={onAdd}><IconPlus />등록</Button><Button variant="ghost" onClick={onClose}>닫기</Button></>}>
      {list.length === 0 && <EmptyState size="sm" message="등록된 즐겨찾기가 없습니다." />}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={list.map((f) => f.id)} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col">
            {list.map((f) => (
              <FavoriteSortableRow key={f.id} f={f} catLabel={catMap[f.category] ?? f.category} busy={busy} onEdit={() => onEdit(f)} onRemove={() => remove(f)} />
            ))}
          </div>
        </SortableContext>
      </DndContext>
      {confirmElement}
    </Modal>
  );
}

// 즐겨찾기 관리의 한 줄 — 끌기 손잡이 + 내용 + 수정·삭제
function FavoriteSortableRow({ f, catLabel, busy, onEdit, onRemove }: { f: TransactionFavorite; catLabel: string; busy: boolean; onEdit: () => void; onRemove: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: f.id });
  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 1 : undefined,
  };
  return (
    <div ref={setNodeRef} style={style} className="py-2 border-b border-border-subtle last:border-b-0 flex items-center gap-2 bg-background">
      <IconButton label="순서 변경" variant="handle" size="lg" {...attributes} {...listeners}>
        <IconDrag />
      </IconButton>
      <div className="flex-1 min-w-0">
        <div className="text-[0.84rem] text-primary truncate">{f.title}</div>
        <div className="text-[0.72rem] text-muted">
          {TX_TYPE_LABEL[f.type]} · {catLabel} · <span className={`amount-${f.type}`}>{ledgerAmount(f.type, f.amount)}</span>
        </div>
      </div>
      <IconButton label="수정" size="lg" disabled={busy} onClick={onEdit}><IconEdit /></IconButton>
      <IconButton label="삭제" variant="danger" size="lg" disabled={busy} onClick={onRemove}><IconTrash /></IconButton>
    </div>
  );
}

// 대분류 code → 거래 유형 (income/transfer 대분류만 해당 유형, 나머지는 지출)
function parentTypeOf(parentCode: string | null | undefined): TransactionType {
  if (parentCode === 'income') return 'income';
  if (parentCode === 'transfer') return 'transfer';
  return 'expense';
}

function LedgerModal({ state, categories, bankCats: allBanks, payMethodCats: allPays, onClose, onSaved }: { state: ModalState; categories: Category[]; bankCats: Category[]; payMethodCats: Category[]; onClose: () => void; onSaved: () => void }) {
  const e = state.editing;
  // 목록은 비활성 포함 전체 — 선택지는 사용 중인 것 + 기존 값(수정 대상 또는 불러온 즐겨찾기)
  const keepCategory = e?.category ?? state.prefill?.category;
  const keepPay = e?.payMethod ?? state.prefill?.payMethod;
  const { parents, leaves } = useMemo(() => categoryOptions(categories, keepCategory), [categories, keepCategory]);
  const bankCats = useMemo(() => activeWith(allBanks, keepPay), [allBanks, keepPay]);
  const payMethodCats = useMemo(() => activeWith(allPays, keepPay), [allPays, keepPay]);
  const [type, setType] = useState<TransactionType>('expense');
  const [date, setDate] = useState('');
  const [title, setTitle] = useState('');
  const [parentCode, setParentCode] = useState('');
  const [category, setCategory] = useState('');
  const [amount, setAmount] = useState('');
  const [payMethod, setPayMethod] = useState(payMethodCats[0]?.code ?? '');
  const [memo, setMemo] = useState('');
  const [targetType, setTargetType] = useState<TransferTarget | ''>('');
  const [targetId, setTargetId] = useState<number | ''>('');
  const [saving, setSaving] = useState(false);
  const { errors, setErrors, clearError, reset } = useFormErrors();

  // 분류 · 결제수단 목록이 다 왔는지 — 대시보드 '지출 기록'이나 검색 결과로 창이 목록보다 먼저 열리면, 도착했을 때 폼을 다시 채운다
  const listsReady = leaves.length > 0 && payMethodCats.length > 0 && bankCats.length > 0;
  const targetPickerOpen = state.open && type === 'transfer';
  // 이동 대상 후보 — 자산이동일 때만 조회(연동 없이 단순 기록도 허용하므로 항상 강제하지 않음)
  const savingsQuery = useApiQuery<Saving[]>(qk.savings.list('transfer-target'), '/savings', { enabled: targetPickerOpen && targetType === 'saving' });
  // 투자는 종목(Investment)이 아니라 예수금을 보유한 투자 계좌(InvestmentAccount)가 자산이동 대상
  const investmentAccountsQuery = useApiQuery<InvestmentAccount[]>(qk.investmentAccounts.list('transfer-target'), '/investment-accounts', { enabled: targetPickerOpen && targetType === 'investment' });
  const targetItems: { id: number; label: string }[] = targetType === 'saving'
    ? (savingsQuery.data ?? []).map((s) => ({ id: s.id, label: `${allBanks.find((b) => b.code === s.bank)?.label ?? s.bank} · ${s.name}` }))
    : targetType === 'investment'
      ? (investmentAccountsQuery.data ?? []).map((a) => ({ id: a.id, label: a.name }))
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
    setDate(e?.date ?? pf?.date ?? localDate());
    setTitle(e?.title ?? pf?.title ?? '');
    setParentCode(initParent);
    setCategory(initLeaf);
    setAmount(e ? String(e.amount) : pf?.amount ? String(pf.amount) : '');
    setPayMethod(e?.payMethod ?? pf?.payMethod ?? (initType === 'income' ? (bankCats[0]?.code ?? '') : initType === 'transfer' ? '' : (payMethodCats[0]?.code ?? '')));
    setMemo(e?.memo ?? pf?.memo ?? '');
    setTargetType(e ? (e.targetType ?? '') : (pf?.targetType ?? ''));
    setTargetId(e ? (e.targetId ?? '') : (pf?.targetId ?? ''));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 모달 열림/수정대상 변경 · 목록 도착 시에만 폼 초기화
  }, [state.open, e, listsReady]);

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
    setPayMethod(t === 'expense' ? (payMethodCats[0]?.code ?? '') : t === 'income' ? (bankCats[0]?.code ?? '') : '');
    if (t !== 'transfer') { setTargetType(''); setTargetId(''); }
  }

  // 이동 대상 종류 변경 시 항목 선택 초기화 (목록이 바뀌므로)
  function handleChangeTargetType(tt: TransferTarget | '') {
    setTargetType(tt);
    setTargetId('');
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
      <FieldGroup label="유형" required>
        <Segmented label="유형" variant="joined" className="w-full *:flex-1" items={TYPE_ITEMS} value={type} onChange={handleChangeType} />
      </FieldGroup>
      <Field label="날짜" required error={errors.date}>
        <input type="date" className="input" aria-label="날짜" value={date} onChange={(ev) => { setDate(ev.target.value); clearError('date'); }} />
      </Field>
      <Field label="내역" required error={errors.title}>
        <input type="text" className="input" placeholder="예: 스타벅스" value={title} onChange={(ev) => { setTitle(ev.target.value); clearError('title'); }} />
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
        <input type="number" className="input" placeholder="0" value={amount} onChange={(ev) => { setAmount(ev.target.value); clearError('amount'); }} />
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
      {type === 'expense' && (
        <Field label="결제수단" required>
          <select className="input" aria-label="결제수단" value={payMethod} onChange={(ev) => setPayMethod(ev.target.value)}>
            <option value="" disabled>결제수단 선택</option>
            {/* 기존 값이 목록에 없으면 그대로 노출 */}
            {payMethod && !payMethodCats.some((m) => m.code === payMethod) && <option value={payMethod}>{payMethod}</option>}
            {payMethodCats.map((m) => <option key={m.code} value={m.code}>{m.label}</option>)}
          </select>
        </Field>
      )}
      {type === 'income' && (
        <Field label="입금 은행" required>
          <select className="input" aria-label="입금 은행" value={payMethod} onChange={(ev) => setPayMethod(ev.target.value)}>
            <option value="" disabled>은행 선택</option>
            {/* 기존 값이 목록에 없으면 그대로 노출 */}
            {payMethod && !bankCats.some((b) => b.code === payMethod) && <option value={payMethod}>{payMethod}</option>}
            {bankCats.map((b) => <option key={b.code} value={b.code}>{b.label}</option>)}
          </select>
        </Field>
      )}
      <Field label="메모 (선택)"><input type="text" className="input" placeholder="간단한 메모" value={memo} onChange={(ev) => setMemo(ev.target.value)} /></Field>
    </Modal>
  );
}

// 자동이체 설정 모달 — "데이터는 그냥 생성만" 원칙에 따라 거래 생성 모달과 완전히 분리된 반복 규칙 등록/수정 전용 모달.
// 저장 시 실제 거래는 만들지 않고 RecurringSchedule만 생성/수정 — 회차 생성은 크론이 규칙에 따라 처리한다.
function RecurringTransactionModal({ state, categories, bankCats: allBanks, payMethodCats: allPays, onClose, onSaved }: { state: RecurringModalState; categories: Category[]; bankCats: Category[]; payMethodCats: Category[]; onClose: () => void; onSaved: () => void }) {
  const r = state.editing;
  // 목록은 비활성 포함 전체 — 선택지는 사용 중인 것 + 기존 값
  const { parents, leaves } = useMemo(() => categoryOptions(categories, r?.category), [categories, r]);
  const bankCats = useMemo(() => activeWith(allBanks, r?.payMethod), [allBanks, r]);
  const payMethodCats = useMemo(() => activeWith(allPays, r?.payMethod), [allPays, r]);
  const [type, setType] = useState<TransactionType>('expense');
  const [startDate, setStartDate] = useState('');
  const [title, setTitle] = useState('');
  const [parentCode, setParentCode] = useState('');
  const [category, setCategory] = useState('');
  const [amount, setAmount] = useState('');
  const [payMethod, setPayMethod] = useState(payMethodCats[0]?.code ?? '');
  const [memo, setMemo] = useState('');
  const [active, setActive] = useState(true);
  const [recurringCycle, setRecurringCycle] = useState<RecurringCycle>('monthly');
  const [recurringDay, setRecurringDay] = useState(1);
  const [recurringMonth, setRecurringMonth] = useState(1);
  const [weekendAdjust, setWeekendAdjust] = useState<WeekendAdjust>('none');
  const [targetType, setTargetType] = useState<TransferTarget | ''>('');
  const [targetId, setTargetId] = useState<number | ''>('');
  const [saving, setSaving] = useState(false);
  const { errors, setErrors, clearError, reset } = useFormErrors();

  const targetPickerOpen = state.open && type === 'transfer';
  const savingsQuery = useApiQuery<Saving[]>(qk.savings.list('transfer-target'), '/savings', { enabled: targetPickerOpen && targetType === 'saving' });
  const investmentAccountsQuery = useApiQuery<InvestmentAccount[]>(qk.investmentAccounts.list('transfer-target'), '/investment-accounts', { enabled: targetPickerOpen && targetType === 'investment' });
  const targetItems: { id: number; label: string }[] = targetType === 'saving'
    ? (savingsQuery.data ?? []).map((s) => ({ id: s.id, label: `${allBanks.find((b) => b.code === s.bank)?.label ?? s.bank} · ${s.name}` }))
    : targetType === 'investment'
      ? (investmentAccountsQuery.data ?? []).map((a) => ({ id: a.id, label: a.name }))
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
    setStartDate(r?.startDate ?? localDate());
    setTitle(r?.title ?? '');
    setParentCode(initParent);
    setCategory(initLeaf);
    setAmount(r?.amount != null ? String(r.amount) : '');
    setPayMethod(r?.payMethod ?? (initType === 'income' ? (bankCats[0]?.code ?? '') : initType === 'transfer' ? '' : (payMethodCats[0]?.code ?? '')));
    setMemo(r?.memo ?? '');
    setActive(r?.active ?? true);
    setRecurringCycle(r?.rule?.cycle ?? 'monthly');
    // 새 설정은 시작일(오늘)의 날짜 · 달을 기준일로 — 14일에 만들면 매월 14일
    const init = ruleDayFor(r?.rule?.cycle ?? 'monthly', localDate());
    setRecurringDay(r?.rule?.day ?? init.day);
    setRecurringMonth(r?.rule?.month ?? init.month);
    setWeekendAdjust(r?.rule?.weekendAdjust ?? 'none');
    setTargetType(r?.targetType ?? '');
    setTargetId(r?.targetId ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 모달 열림/수정대상 변경 시에만 폼 초기화
  }, [state.open, r]);

  // 반복 주기를 바꾸면 기준일을 시작일에 맞춘다 — 매주는 요일(0~6), 매월 · 매년은 날짜라 같은 값을 그대로 쓰면 범위를 벗어난다
  function handleChangeCycle(c: RecurringCycle) {
    setRecurringCycle(c);
    const next = ruleDayFor(c, startDate);
    setRecurringDay(next.day);
    setRecurringMonth(next.month);
  }

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
    setPayMethod(t === 'expense' ? (payMethodCats[0]?.code ?? '') : t === 'income' ? (bankCats[0]?.code ?? '') : '');
    if (t !== 'transfer') { setTargetType(''); setTargetId(''); }
  }

  function handleChangeTargetType(tt: TransferTarget | '') {
    setTargetType(tt);
    setTargetId('');
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
    <Modal
      open={state.open}
      onClose={onClose}
      size="lg"
      title={r ? '자동이체 설정 수정' : '자동이체 설정 추가'}
      subtitle={r ? `${r.title}${r.nextRunDate ? ` · 다음 실행 ${dotDate(r.nextRunDate)}` : ''}` : undefined}
      footer={<ModalFooter onClose={onClose} onSave={handleSave} saving={saving} />}
    >
      <FormGroup no={1} title="무엇을" first>
        <FieldGroup label="유형" required>
          <Segmented label="유형" variant="joined" className="w-full *:flex-1" items={TYPE_ITEMS} value={type} onChange={handleChangeType} />
        </FieldGroup>
        <div className="grid grid-cols-2 gap-3 max-md:grid-cols-1">
          <Field label="내역" required error={errors.title}>
            <input type="text" className="input" placeholder="예: 월세" value={title} onChange={(ev) => { setTitle(ev.target.value); clearError('title'); }} />
          </Field>
          <Field label="금액 (원)" required error={errors.amount}>
            <input type="number" className="input" placeholder="0" value={amount} onChange={(ev) => { setAmount(ev.target.value); clearError('amount'); }} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3 max-md:grid-cols-1">
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
        {type === 'transfer' && (
          <div className="grid grid-cols-2 gap-3 max-md:grid-cols-1">
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
        {type === 'expense' && (
          <Field label="결제수단" required>
            <select className="input" aria-label="결제수단" value={payMethod} onChange={(ev) => setPayMethod(ev.target.value)}>
              <option value="" disabled>결제수단 선택</option>
              {payMethod && !payMethodCats.some((m) => m.code === payMethod) && <option value={payMethod}>{payMethod}</option>}
              {payMethodCats.map((m) => <option key={m.code} value={m.code}>{m.label}</option>)}
            </select>
          </Field>
        )}
        {type === 'income' && (
          <Field label="입금 은행" required>
            <select className="input" aria-label="입금 은행" value={payMethod} onChange={(ev) => setPayMethod(ev.target.value)}>
              <option value="" disabled>은행 선택</option>
              {payMethod && !bankCats.some((b) => b.code === payMethod) && <option value={payMethod}>{payMethod}</option>}
              {bankCats.map((b) => <option key={b.code} value={b.code}>{b.label}</option>)}
            </select>
          </Field>
        )}
        <Field label="메모 (선택)"><input type="text" className="input" placeholder="간단한 메모" value={memo} onChange={(ev) => setMemo(ev.target.value)} /></Field>
      </FormGroup>

      <FormGroup no={2} title="언제">
        <div className="grid grid-cols-2 gap-3 max-md:grid-cols-1">
          <Field label="시작일" required error={errors.startDate}>
            <input type="date" className="input" value={startDate} onChange={(ev) => { setStartDate(ev.target.value); clearError('startDate'); }} />
          </Field>
          <FieldGroup label="반복 주기" required>
            <Segmented label="반복 주기" variant="joined" className="w-full *:flex-1" items={CYCLE_ITEMS} value={recurringCycle} onChange={handleChangeCycle} />
          </FieldGroup>
        </div>
        {recurringCycle === 'weekly' ? (
          <Field label="요일" required>
            <select className="input" value={recurringDay} onChange={(ev) => setRecurringDay(Number(ev.target.value))}>
              {WEEKDAY_LABEL.map((label, d) => <option key={d} value={d}>{label}요일</option>)}
            </select>
          </Field>
        ) : recurringCycle === 'daily' ? (
          <p className="flex items-center gap-1.5 text-[0.82rem] text-secondary"><IconInfo width={14} height={14} className="shrink-0 text-muted" />평일(월~금)에만 생성됩니다.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 max-md:grid-cols-1">
            {recurringCycle === 'yearly' && (
              <Field label="월" required>
                <select className="input" value={recurringMonth} onChange={(ev) => setRecurringMonth(Number(ev.target.value))}>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => <option key={m} value={m}>{m}월</option>)}
                </select>
              </Field>
            )}
            <Field label="기준일" required>
              <select className="input" value={recurringDay} onChange={(ev) => setRecurringDay(Number(ev.target.value))}>
                {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                  <option key={d} value={d}>{d}일</option>
                ))}
              </select>
            </Field>
            <Field label="주말인 경우">
              <select className="input" value={weekendAdjust} onChange={(ev) => setWeekendAdjust(ev.target.value as WeekendAdjust)}>
                {(Object.entries(WEEKEND_ADJUST_LABEL) as [WeekendAdjust, string][]).map(([v, label]) => <option key={v} value={v}>{label}</option>)}
              </select>
            </Field>
          </div>
        )}
      </FormGroup>

      <div className="flex items-center gap-3 pt-4 border-t border-border-subtle">
        <div className="flex-1 flex flex-col">
          <span className="text-[0.875rem] text-primary">활성</span>
          <span className="text-[0.78rem] text-muted">끄면 다음 회차를 만들지 않습니다</span>
        </div>
        <Toggle on={active} onToggle={() => setActive(!active)} label="활성" />
      </div>
    </Modal>
  );
}
