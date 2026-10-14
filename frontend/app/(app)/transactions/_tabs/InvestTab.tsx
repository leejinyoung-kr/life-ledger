'use client';

import { useMemo, useState } from 'react';
import StatCard, { StatStrip } from '@/components/StatCard';
import Pagination, { LimitSelect } from '@/components/Pagination';
import ListToolbar from '@/components/ListToolbar';
import Button from '@/components/ui/Button';
import IconButton from '@/components/ui/IconButton';
import MoreMenu from '@/components/ui/MoreMenu';
import Segmented from '@/components/ui/Segmented';
import SearchInput from '@/components/ui/SearchInput';
import Badge from '@/components/ui/Badge';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { useConfirm } from '@/components/ConfirmModal';
import {
  IconTrendUp, IconWon, IconChart, IconPlus, IconRepeat, IconTransfer, IconEdit, IconTrash,
  IconPause, IconPlay, IconCopy, IconRefresh,
} from '@/components/icons';
import { notify } from '@/lib/toast';
import { api } from '@/lib/api';
import { useApiQuery, useInvalidate, type Paginated } from '@/lib/query';
import { usePagination } from '@/lib/usePagination';
import { useRowSelection } from '@/lib/useRowSelection';
import { qk } from '@/lib/queryKeys';
import EmptyState from '@/components/EmptyState';
import MobileCard, { MobileCardList } from '@/components/MobileCard';
import TableEmptyRow from '@/components/TableEmptyRow';
import FilterPanel from '@/components/FilterPanel';
import {
  INVEST_TYPE_LABEL, won, usd, dotDate, daysUntil, recurringRuleSummary,
  type Category, type Investment, type InvestmentAccount, type InvestmentSummary, type RecurringSchedule,
} from '@/lib/finance';
import { useAddTrigger } from '../_shared';
import {
  InvestModal, TradeModal, PriceLookupModal, AccountModal, ExchangeModal, RecurringInvestmentModal,
  type ModalState, type TradeState, type AccountModalState, type ExchangeModalState, type PriceState, type RecurringModalState,
} from './InvestModals';

// 반복매수 회차당 매수량 — "₩20,000" · "$50" · "1주"
function recurringAmountLabel(schedule: RecurringSchedule, isForeign: boolean): string {
  if (schedule.buyQuantity) return `${schedule.buyQuantity}주`;
  return isForeign ? `$${(schedule.buyAmount ?? 0).toLocaleString('en-US')}` : won(schedule.buyAmount ?? 0);
}

// 반복매수 요약 — "매월 5일 · ₩20,000" 또는 "매월 5일 · 1주" 형태
function recurringBuyLabel(schedule: RecurringSchedule, isForeign: boolean): string {
  return `${recurringRuleSummary(schedule.rule)} · ${recurringAmountLabel(schedule, isForeign)}`;
}

const isForeignType = (t: Investment['type']) => t === 'foreign_stock' || t === 'foreign_etf';

export default function InvestTab({ investCats, addTrigger }: { investCats: Category[]; addTrigger: number }) {
  const { page, setPage, limit, changeLimit } = usePagination();
  const { confirm, confirmElement } = useConfirm();
  const [modal, setModal] = useState<ModalState>({ open: false, mode: 'add' });
  const [trade, setTrade] = useState<TradeState>({ open: false, mode: 'buy' });
  const [priceLookup, setPriceLookup] = useState<PriceState>({ open: false });
  const [accountModal, setAccountModal] = useState<AccountModalState>({ open: false, mode: 'add' });
  const [exchangeModal, setExchangeModal] = useState<ExchangeModalState>({ open: false });
  const [recurringModal, setRecurringModal] = useState<RecurringModalState>({ open: false });
  const [currency, setCurrency] = useState<'USD' | 'KRW'>('KRW');
  const invalidate = useInvalidate();

  const [pendingName, setPendingName] = useState('');
  const [pendingType, setPendingType] = useState('');
  const [pendingAccount, setPendingAccount] = useState('');
  const [applied, setApplied] = useState({ name: '', type: '', accountId: '' });

  useAddTrigger(addTrigger, () => setModal({ open: true, mode: 'add' }));

  function handleSearch() { setApplied({ name: pendingName, type: pendingType, accountId: pendingAccount }); setPage(1); }
  function handleReset() { setPendingName(''); setPendingType(''); setPendingAccount(''); setApplied({ name: '', type: '', accountId: '' }); setPage(1); }

  // 투자 계좌 목록 (예수금 공유 단위) — 보유 종목 select·필터·매수/매도 한도 안내에 모두 사용
  const accountsQuery = useApiQuery<InvestmentAccount[]>(qk.investmentAccounts.list(), '/investment-accounts');
  const accounts = useMemo(() => accountsQuery.data ?? [], [accountsQuery.data]);
  const accountMap = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);

  // 투자 목록 + 요약 (React Query 캐시). 목록은 서버 페이징/필터
  const listQs = useMemo(() => {
    const params = new URLSearchParams();
    if (applied.type) params.set('type', applied.type);
    if (applied.name) params.set('q', applied.name);
    if (applied.accountId) params.set('accountId', applied.accountId);
    params.set('page', String(page));
    params.set('limit', String(limit));
    return params.toString();
  }, [applied, page, limit]);
  const rowsQuery = useApiQuery<Paginated<Investment>>(qk.investments.list({ ...applied, page, limit }), `/investments?${listQs}`);
  const summaryQuery = useApiQuery<InvestmentSummary>(['investments', 'summary'], '/investments/summary');
  const rows = useMemo(() => rowsQuery.data?.items ?? [], [rowsQuery.data]);
  const total = rowsQuery.data?.total ?? 0;
  const summary = summaryQuery.data ?? null;
  const hasForeign = rows.some((r) => isForeignType(r.type));
  // 자산이동/매수/매도가 계좌 예수금도 바꿀 수 있어 계좌 쿼리도 함께 무효화
  const reload = () => invalidate(qk.investments.all, qk.investmentAccounts.all);
  const reloadRecurring = () => invalidate(qk.recurringSchedules.all);

  // 반복매수 자동이체 설정 — 종목별 아이콘·요약 표시에 investmentId로 조회
  const recurringQuery = useApiQuery<RecurringSchedule[]>(qk.recurringSchedules.list('investment'), '/recurring-schedules?kind=investment');
  const recurringSchedules = useMemo(() => recurringQuery.data ?? [], [recurringQuery.data]);
  const scheduleByInvestmentId = useMemo(
    () => new Map(recurringSchedules.filter((s) => s.investmentId != null).map((s) => [s.investmentId as number, s])),
    [recurringSchedules],
  );

  async function handleToggleRecurring(id: number) {
    try {
      await api.patch(`/recurring-schedules/${id}/toggle`, {});
      reloadRecurring();
    } catch {
      notify.saveFailed();
    }
  }

  async function handleRemoveRecurring(id: number) {
    if (!await confirm('이 자동이체 설정을 삭제할까요? 이미 매수된 수량은 유지됩니다.', 'danger')) return;
    try {
      await api.del(`/recurring-schedules/${id}`);
      notify.deleted('자동이체 설정');
      reloadRecurring();
    } catch {
      notify.deleteFailed();
    }
  }

  async function handleRemove(id: number) {
    if (!await confirm('이 투자 항목을 삭제할까요?', 'danger')) return;
    try {
      await api.del(`/investments/${id}`);
      notify.deleted('투자 항목');
      clear();
      reload();
    } catch {
      notify.deleteFailed();
    }
  }

  // 투자 항목 복사 — 해당 데이터로 채운 추가 모달을 오늘 날짜로 열어 확인 후 저장
  function handleDuplicate(row: Investment) {
    setModal({ open: true, mode: 'add', prefill: row });
  }

  async function handleRemoveSelected() {
    if (selected.size === 0) return;
    if (!await confirm(`선택한 ${selected.size}건을 삭제할까요?`, 'danger')) return;
    try {
      await api.del('/investments/bulk', { ids: [...selected] });
      notify.deleted(`${selected.size}건`);
      clear();
      reload();
    } catch {
      notify.deleteFailed();
    }
  }

  async function handleRemoveAccount(id: number) {
    if (!await confirm('이 투자 계좌를 삭제할까요? 보유 종목이 남아있으면 삭제할 수 없습니다.', 'danger')) return;
    try {
      await api.del(`/investment-accounts/${id}`);
      notify.deleted('투자 계좌');
      reload();
    } catch (err) {
      notify.error((err as Error).message || '삭제에 실패했습니다.');
    }
  }

  // 해외종목 통화 표기 헬퍼 — currency=USD이고 환율이 있을 때만 달러로 변환
  function fmtPrincipal(row: Investment) {
    if (isForeignType(row.type) && currency === 'USD' && row.principalUsd !== null) return usd(row.principalUsd);
    return won(row.principal);
  }
  function fmtCurrentValue(row: Investment) {
    if (isForeignType(row.type) && currency === 'USD' && row.currentValueUsd !== null) return usd(row.currentValueUsd);
    return won(row.currentValue);
  }
  // 수익 — 부호(▲ ▼)를 글자에 같이 붙이고 색은 up 여부로 정한다
  function fmtProfit(row: Investment): { text: string; up: boolean } {
    if (isForeignType(row.type) && currency === 'USD' && row.principalUsd !== null && row.currentValueUsd !== null) {
      const profitUsd = row.currentValueUsd - row.principalUsd;
      return { text: `${profitUsd >= 0 ? '▲' : '▼'} ${usd(Math.abs(profitUsd))}`, up: profitUsd >= 0 };
    }
    const up = row.profit >= 0;
    return { text: `${up ? '▲' : '▼'} ${won(Math.abs(row.profit))}`, up };
  }

  const profitUp = (summary?.totalProfit ?? 0) >= 0;
  const totalPages = Math.ceil(total / limit);
  const paged = rows; // 서버가 이미 필터+페이지 단위로 잘라서 보냄
  const { selected, toggle, toggleAll, clear, allChecked } = useRowSelection(paged.map((r) => r.id));

  const openEdit = (row: Investment) => setModal({ open: true, mode: 'edit', editing: row });

  // 표 종목 행 더보기 — 매수 · 매도는 옆에 버튼이 따로 있다
  function rowMenu(row: Investment) {
    return (
      <MoreMenu
        items={[
          ...(row.symbol ? [{ label: '시세조회', icon: <IconRefresh />, onSelect: () => setPriceLookup({ open: true, target: row }) }] : []),
          { label: '수정', icon: <IconEdit />, onSelect: () => openEdit(row) },
          { label: '복사', icon: <IconCopy />, onSelect: () => handleDuplicate(row) },
          { label: '삭제', icon: <IconTrash />, danger: true, onSelect: () => handleRemove(row.id) },
        ]}
      />
    );
  }

  return (
    <>
      {summary && (
        <StatStrip>
          <StatCard icon={<IconTrendUp />} tone="blue" value={won(summary.totalValue)} label="총 평가금액" change={`${profitUp ? '▲' : '▼'} 원금 대비 ${Math.abs(summary.profitRate)}%`} changeDir={profitUp ? 'up' : 'down'} />
          <StatCard icon={<IconWon />} tone="amber" value={won(summary.totalPrincipal)} label="총 투자원금" change="투자 원금 합계" changeDir="neutral" />
          <StatCard icon={<IconChart />} tone={profitUp ? 'green' : 'red'} value={`${profitUp ? '▲' : '▼'} ${won(Math.abs(summary.totalProfit))}`} valueTone={profitUp ? 'in' : 'out'} label="총 수익" change={`수익률 ${profitUp ? '+' : '-'}${Math.abs(summary.profitRate)}%`} changeDir={profitUp ? 'up' : 'down'} />
        </StatStrip>
      )}

      <div className="grid grid-cols-2 gap-6 mb-7 max-lg:grid-cols-1">
        <Card clip className="min-w-0 flex flex-col">
          <CardHeader>
            <CardTitle>투자 계좌</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => setAccountModal({ open: true, mode: 'add' })}><IconPlus />계좌 추가</Button>
          </CardHeader>
          {accounts.length === 0 && <EmptyState size="sm" message="투자 계좌가 없습니다. 계좌를 먼저 추가하세요." />}
          {accounts.map((a) => {
            const dleft = daysUntil(a.maturityDate);
            const near = dleft !== null && dleft >= 0 && dleft <= 30;
            const matured = dleft !== null && dleft < 0;
            return (
              <div key={a.id} className="flex items-center gap-3 min-h-14 px-4.5 py-3 border-b border-border-subtle last:border-b-0">
                <div className="flex-1 min-w-0 flex flex-col leading-snug">
                  <span>{a.name}{a.accountNumber && <span className="text-[0.75rem] text-muted tabular-nums ml-1.5">{a.accountNumber}</span>}</span>
                  <span className="text-[0.75rem] text-muted">
                    보유 {a.holdingsCount}종목 · 평가금액 {won(a.totalCurrentValue)}
                    {a.cashBalanceUsd > 0 && ` · 달러 예수금 $${a.cashBalanceUsd.toLocaleString('en-US')}`}
                    {a.memo && ` · ${a.memo}`}
                  </span>
                  {a.maturityDate && (
                    <span className={`text-[0.75rem] ${near || matured ? 'text-warning' : 'text-muted'}`}>
                      만기 {dotDate(a.maturityDate)}{near && ` · D-${dleft}`}{matured && ' · 만기됨'}
                    </span>
                  )}
                </div>
                <div className="flex flex-col items-end leading-snug shrink-0">
                  <span className="tabular-nums">{won(a.cashBalance)}</span>
                  <span className="text-[0.72rem] text-muted">원화 예수금</span>
                </div>
                <div className="flex gap-0.5 max-md:hidden">
                  <IconButton label="환전" onClick={() => setExchangeModal({ open: true, account: a })}><IconTransfer /></IconButton>
                  <IconButton label="수정" onClick={() => setAccountModal({ open: true, mode: 'edit', editing: a })}><IconEdit /></IconButton>
                  <IconButton label="삭제" variant="danger" onClick={() => handleRemoveAccount(a.id)}><IconTrash /></IconButton>
                </div>
                <div className="md:hidden">
                  <MoreMenu
                    size="lg"
                    items={[
                      { label: '환전', icon: <IconTransfer />, onSelect: () => setExchangeModal({ open: true, account: a }) },
                      { label: '수정', icon: <IconEdit />, onSelect: () => setAccountModal({ open: true, mode: 'edit', editing: a }) },
                      { label: '삭제', icon: <IconTrash />, danger: true, onSelect: () => handleRemoveAccount(a.id) },
                    ]}
                  />
                </div>
              </div>
            );
          })}
        </Card>

        <Card clip className="min-w-0 flex flex-col">
          <CardHeader>
            <CardTitle>반복매수 자동화</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => setRecurringModal({ open: true })}><IconPlus />설정 추가</Button>
          </CardHeader>
          {recurringSchedules.length === 0 && <EmptyState size="sm" message="등록된 반복매수 설정이 없습니다." />}
          {recurringSchedules.map((s) => {
            const inv = rows.find((r) => r.id === s.investmentId);
            const isForeign = inv ? isForeignType(inv.type) : false;
            return (
              <div className="flex items-center gap-3 min-h-14 px-4.5 py-3 border-b border-border-subtle last:border-b-0" key={s.id}>
                <div className="flex-1 min-w-0 flex flex-col leading-snug">
                  <span className="flex items-center gap-1.5">
                    {s.investmentName ?? `#${s.investmentId}`}
                    {!s.active && <Badge tone="neutral">일시정지</Badge>}
                  </span>
                  <span className="text-[0.75rem] text-muted">
                    {recurringRuleSummary(s.rule)}{s.nextRunDate && ` · 다음 ${s.nextRunDate}`}
                  </span>
                </div>
                <span className={`tabular-nums shrink-0 ${s.buyQuantity ? '' : 'amount-transfer'}`}>
                  {s.buyQuantity ? '' : '⇄ '}{recurringAmountLabel(s, isForeign)}
                </span>
                <div className="flex gap-0.5 max-md:hidden">
                  <IconButton label={s.active ? '일시정지' : '재개'} onClick={() => handleToggleRecurring(s.id)}>{s.active ? <IconPause /> : <IconPlay />}</IconButton>
                  <IconButton label="수정" onClick={() => setRecurringModal({ open: true, editing: s })}><IconEdit /></IconButton>
                  <IconButton label="삭제" variant="danger" onClick={() => handleRemoveRecurring(s.id)}><IconTrash /></IconButton>
                </div>
                <div className="md:hidden">
                  <MoreMenu
                    size="lg"
                    items={[
                      { label: s.active ? '일시정지' : '재개', icon: s.active ? <IconPause /> : <IconPlay />, onSelect: () => handleToggleRecurring(s.id) },
                      { label: '수정', icon: <IconEdit />, onSelect: () => setRecurringModal({ open: true, editing: s }) },
                      { label: '삭제', icon: <IconTrash />, danger: true, onSelect: () => handleRemoveRecurring(s.id) },
                    ]}
                  />
                </div>
              </div>
            );
          })}
        </Card>
      </div>

      <FilterPanel className="mb-0 border-b-0">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:flex-wrap">
          <div className="flex gap-2 md:contents">
            <select className="input flex-1 md:flex-none md:w-auto md:min-w-30 shrink-0" value={pendingAccount} onChange={(ev) => setPendingAccount(ev.target.value)} aria-label="계좌 필터">
              <option value="">전체 계좌</option>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
            <select className="input flex-1 md:flex-none md:w-auto md:min-w-30 shrink-0" value={pendingType} onChange={(ev) => setPendingType(ev.target.value)} aria-label="유형 필터">
              <option value="">전체 유형</option>
              {investCats.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
            </select>
          </div>
          <div className="flex gap-2 items-center flex-1">
            <SearchInput label="종목명 검색" className="flex-1 min-w-0" placeholder="종목명 검색" value={pendingName} onChange={(ev) => setPendingName(ev.target.value)} onEnter={handleSearch} />
            <Button onClick={handleSearch}>조회</Button>
          </div>
          <Button variant="ghost" className="w-full md:w-auto" onClick={handleReset}>초기화</Button>
        </div>
      </FilterPanel>

      <ListToolbar
        total={total}
        tools={hasForeign && (
          <Segmented
            label="통화"
            variant="joined"
            value={currency}
            onChange={setCurrency}
            items={[{ value: 'KRW', label: '₩ KRW' }, { value: 'USD', label: '$ USD' }]}
          />
        )}
      >
        <Button variant="danger" size="sm" disabled={selected.size === 0} onClick={handleRemoveSelected}>선택삭제</Button>
        <LimitSelect limit={limit} onLimitChange={changeLimit} />
      </ListToolbar>

      <div className="mb-6">
        <div className="table-wrap max-md:hidden mt-3">
          {/* 1280 미만에서는 투자원금 칸을 숨기고 평가금액 아래 작은 줄로 옮긴다 — 종목 이름이 쪼개지지 않게 */}
          <table>
            <thead>
              <tr>
                <th className="th-left w-10"><input type="checkbox" className="checkbox" checked={allChecked} onChange={toggleAll} aria-label="전체선택" /></th>
                <th className="th-left min-w-36">종목</th>
                <th className="td-right max-xl:hidden">투자원금</th>
                <th className="td-right">평가금액</th>
                <th className="td-right">수익</th>
                <th className="td-right">수익률</th>
                <th className="td-right">관리</th>
              </tr>
            </thead>
            <tbody>
              {paged.length === 0 && <TableEmptyRow colSpan={7} message="투자 항목이 없습니다." />}
              {paged.map((row) => {
                const recurringSchedule = scheduleByInvestmentId.get(row.id);
                const recurring = recurringSchedule ? recurringBuyLabel(recurringSchedule, isForeignType(row.type)) : null;
                const profit = fmtProfit(row);
                return (
                  <tr key={row.id} className="cursor-pointer" onClick={() => openEdit(row)}>
                    <td onClick={(ev) => ev.stopPropagation()}><input type="checkbox" className="checkbox" checked={selected.has(row.id)} onChange={() => toggle(row.id)} aria-label="선택" /></td>
                    <td>
                      <div className="flex flex-col leading-snug min-w-0">
                        <span className="flex items-center gap-1.5">
                          {row.name}
                          {recurring && <IconRepeat className="w-3.25 h-3.25 text-muted shrink-0" aria-label={`반복매수 · ${recurring}`} />}
                        </span>
                        <span className="text-[0.75rem] text-muted">{accountMap.get(row.accountId)?.name ?? '-'} · {INVEST_TYPE_LABEL[row.type]}</span>
                      </div>
                    </td>
                    <td className="td-mono td-right text-muted max-xl:hidden">{fmtPrincipal(row)}</td>
                    <td className="td-mono td-right">
                      {fmtCurrentValue(row)}
                      <span className="xl:hidden block text-[0.72rem] text-muted">원금 {fmtPrincipal(row)}</span>
                    </td>
                    <td className={`td-right amount-${profit.up ? 'income' : 'expense'}`}>{profit.text}</td>
                    <td className="td-right"><span className={`return-pill ${profit.up ? 'up' : 'down'}`}>{profit.up ? '+' : ''}{row.profitRate}%</span></td>
                    <td onClick={(ev) => ev.stopPropagation()}>
                      <div className="flex justify-end items-center gap-1">
                        <Button size="sm" variant="ghost" onClick={() => setTrade({ open: true, mode: 'buy', target: row })}>매수</Button>
                        <Button size="sm" variant="ghost" onClick={() => setTrade({ open: true, mode: 'sell', target: row })}>매도</Button>
                        {rowMenu(row)}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <MobileCardList empty={paged.length === 0 && '투자 항목이 없습니다.'} selection={{ all: allChecked, count: selected.size, onToggleAll: toggleAll }}>
          {paged.map((row) => {
            const recurringSchedule = scheduleByInvestmentId.get(row.id);
            const profit = fmtProfit(row);
            return (
              <MobileCard
                key={row.id}
                checked={selected.has(row.id)}
                onCheck={() => toggle(row.id)}
                title={
                  <span className="flex items-center gap-1.5">
                    {row.name}
                    {recurringSchedule && <IconRepeat className="w-3.25 h-3.25 text-muted shrink-0" aria-label="반복매수" />}
                  </span>
                }
                sub={`${accountMap.get(row.accountId)?.name ?? '-'} · ${INVEST_TYPE_LABEL[row.type]}`}
                aside={<>
                  <span className="text-[0.95rem] font-semibold tabular-nums">{fmtCurrentValue(row)}</span>
                  <span className={`return-pill ${profit.up ? 'up' : 'down'}`}>{profit.up ? '+' : ''}{row.profitRate}%</span>
                </>}
                fields={[
                  { label: '원금', value: fmtPrincipal(row) },
                  { label: '수익', value: <span className={`amount-${profit.up ? 'income' : 'expense'}`}>{profit.text}</span> },
                  { label: '반복매수', value: recurringSchedule ? recurringBuyLabel(recurringSchedule, isForeignType(row.type)) : null },
                ]}
                actions={[
                  [
                    { label: '매수', onClick: () => setTrade({ open: true, mode: 'buy', target: row }) },
                    { label: '매도', onClick: () => setTrade({ open: true, mode: 'sell', target: row }) },
                    ...(row.symbol ? [{ label: '시세조회', onClick: () => setPriceLookup({ open: true, target: row }) }] : []),
                  ],
                  [
                    { label: '복사', onClick: () => handleDuplicate(row) },
                    { label: '수정', onClick: () => openEdit(row) },
                    { label: '삭제', danger: true, onClick: () => handleRemove(row.id) },
                  ],
                ]}
              />
            );
          })}
        </MobileCardList>
        <Pagination page={page} totalPages={totalPages} totalItems={total} onPageChange={setPage} />
      </div>

      <InvestModal
        state={modal}
        accounts={accounts}
        onClose={() => setModal((s) => ({ ...s, open: false }))}
        onSaved={() => { setModal((s) => ({ ...s, open: false })); reload(); }}
      />
      <TradeModal
        state={trade}
        accountMap={accountMap}
        onClose={() => setTrade((s) => ({ ...s, open: false }))}
        onSaved={() => { setTrade((s) => ({ ...s, open: false })); reload(); }}
      />
      <PriceLookupModal
        state={priceLookup}
        onClose={() => setPriceLookup((s) => ({ ...s, open: false }))}
        onSaved={() => { setPriceLookup((s) => ({ ...s, open: false })); reload(); }}
      />
      <AccountModal
        state={accountModal}
        onClose={() => setAccountModal((s) => ({ ...s, open: false }))}
        onSaved={() => { setAccountModal((s) => ({ ...s, open: false })); reload(); }}
      />
      <ExchangeModal
        state={exchangeModal}
        onClose={() => setExchangeModal((s) => ({ ...s, open: false }))}
        onSaved={() => { setExchangeModal((s) => ({ ...s, open: false })); reload(); }}
      />
      <RecurringInvestmentModal
        state={recurringModal}
        onClose={() => setRecurringModal((s) => ({ ...s, open: false }))}
        onSaved={() => { setRecurringModal((s) => ({ ...s, open: false })); reloadRecurring(); }}
      />
      {confirmElement}
    </>
  );
}
