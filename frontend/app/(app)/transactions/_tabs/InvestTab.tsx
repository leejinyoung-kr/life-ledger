'use client';

import { useEffect, useMemo, useState } from 'react';
import StatCard from '@/components/StatCard';
import Modal from '@/components/Modal';
import Pagination, { LimitSelect } from '@/components/Pagination';
import Button from '@/components/ui/Button';
import Segmented from '@/components/ui/Segmented';
import SearchInput from '@/components/ui/SearchInput';
import Badge from '@/components/ui/Badge';
import { Field, ModalFooter } from '@/components/ui/Field';
import { useConfirm } from '@/components/ConfirmModal';
import { IconTrendUp, IconWon, IconChart } from '@/components/icons';
import { notify } from '@/lib/toast';
import { api } from '@/lib/api';
import { useApiQuery, useInvalidate, type Paginated } from '@/lib/query';
import { useFormErrors } from '@/lib/useFormErrors';
import { usePagination } from '@/lib/usePagination';
import { useRowSelection } from '@/lib/useRowSelection';
import { qk } from '@/lib/queryKeys';
import { Card } from '@/components/ui/Card';
import { PageLoading } from '@/components/QueryState';
import EmptyState from '@/components/EmptyState';
import TableEmptyRow from '@/components/TableEmptyRow';
import {
  INVEST_TYPE_LABEL, won, usd, dotDate, daysUntil, localDate, recurringRuleSummary, WEEKDAY_LABEL,
  type Category, type Investment, type InvestmentAccount, type InvestmentSummary, type InvestmentType,
  type RecurringCycle, type WeekendAdjust, type RecurringSchedule,
} from '@/lib/finance';
import {
  TXCARDS, TXCARD, TXCARD_TITLE, TXCARD_AMT,
  RowActions, CardActions, toDay, useAddTrigger,
} from '../_shared';

type ModalState = { open: boolean; mode: 'add' | 'edit'; editing?: Investment; prefill?: Investment };
type TradeState = { open: boolean; mode: 'buy' | 'sell'; target?: Investment };
type AccountModalState = { open: boolean; mode: 'add' | 'edit'; editing?: InvestmentAccount };
type ExchangeModalState = { open: boolean; account?: InvestmentAccount };
type PriceState = { open: boolean; target?: Investment };
type RecurringModalState = { open: boolean; editing?: RecurringSchedule };

// 시세조회 응답 — 단가에 저장된 보유수량을 곱한 평가금액까지 백엔드에서 산출해 내려줌
interface PriceLookupResult {
  price: number;
  currency: 'KRW' | 'USD';
  krwPrice: number;
  name: string | null;
  quantity: number;
  evaluatedValue: number;
}

// 반복매수 요약 — "매월 5일 · ₩20,000" 또는 "매월 5일 · 1주" 형태
function recurringBuyLabel(schedule: RecurringSchedule, isForeign: boolean): string {
  const amountLabel = schedule.buyQuantity
    ? `${schedule.buyQuantity}주`
    : isForeign
      ? `$${(schedule.buyAmount ?? 0).toLocaleString('en-US')}`
      : won(schedule.buyAmount ?? 0);
  return `${recurringRuleSummary(schedule.rule)} · ${amountLabel}`;
}

export default function InvestTab({ investCats, addTrigger }: { investCats: Category[]; addTrigger: number }) {
  const { page, setPage, limit, changeLimit } = usePagination();
  const { confirm, confirmElement } = useConfirm();
  const [modal, setModal] = useState<ModalState>({ open: false, mode: 'add' });
  const [trade, setTrade] = useState<TradeState>({ open: false, mode: 'buy' });
  const [priceLookup, setPriceLookup] = useState<PriceState>({ open: false });
  const [accountModal, setAccountModal] = useState<AccountModalState>({ open: false, mode: 'add' });
  const [exchangeModal, setExchangeModal] = useState<ExchangeModalState>({ open: false });
  const [recurringModal, setRecurringModal] = useState<RecurringModalState>({ open: false });
  const [currency, setCurrency] = useState<'USD' | 'KRW'>('USD');
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
  const hasForeign = rows.some((r) => r.type === 'foreign_stock' || r.type === 'foreign_etf');
  // 자산이동/매수/매도가 계좌 예수금도 바꿀 수 있어 계좌 쿼리도 함께 무효화
  const reload = () => invalidate(qk.investments.all, qk.investmentAccounts.all);
  const reloadRecurring = () => invalidate(qk.recurringSchedules.all);

  // 반복매수 자동이체 설정 — 종목별 배지·요약 표시에 investmentId로 조회
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
    if ((row.type === 'foreign_stock' || row.type === 'foreign_etf') && currency === 'USD' && row.principalUsd !== null) {
      return usd(row.principalUsd);
    }
    return won(row.principal);
  }
  function fmtCurrentValue(row: Investment) {
    if ((row.type === 'foreign_stock' || row.type === 'foreign_etf') && currency === 'USD' && row.currentValueUsd !== null) {
      return usd(row.currentValueUsd);
    }
    return won(row.currentValue);
  }
  function fmtProfit(row: Investment): { text: string; up: boolean } {
    if ((row.type === 'foreign_stock' || row.type === 'foreign_etf') && currency === 'USD' && row.principalUsd !== null && row.currentValueUsd !== null) {
      const profitUsd = row.currentValueUsd - row.principalUsd;
      return { text: `${profitUsd >= 0 ? '+' : '-'}${usd(Math.abs(profitUsd))}`, up: profitUsd >= 0 };
    }
    const up = row.profit >= 0;
    return { text: `${up ? '+' : '-'}${won(Math.abs(row.profit))}`, up };
  }

  const profitUp = (summary?.totalProfit ?? 0) >= 0;
  const totalPages = Math.ceil(total / limit);
  const paged = rows; // 서버가 이미 필터+페이지 단위로 잘라서 보냄
  const { selected, toggle, toggleAll, clear, allChecked } = useRowSelection(paged.map((r) => r.id));

  return (
    <>
      {summary && (
        <div className="grid grid-cols-2 gap-3 mb-6 min-[1100px]:grid-cols-3 min-[1100px]:gap-4">
          <div className="col-span-2 min-[1100px]:col-span-1">
            <StatCard icon={<IconTrendUp />} tone="blue" value={won(summary.totalValue)} label="총 평가금액" change={`원금 대비 ${profitUp ? '+' : ''}${summary.profitRate}%`} changeDir={profitUp ? 'up' : 'down'} />
          </div>
          <StatCard icon={<IconWon />} tone="amber" value={won(summary.totalPrincipal)} label="총 투자원금" change="투자 원금 합계" changeDir="neutral" />
          <StatCard icon={<IconChart />} tone={profitUp ? 'green' : 'red'} value={`${profitUp ? '+' : '-'}${won(summary.totalProfit)}`} label="총 수익" change={`수익률 ${profitUp ? '+' : ''}${summary.profitRate}%`} changeDir={profitUp ? 'up' : 'down'} />
        </div>
      )}

      <div className="flex items-center justify-between mb-2">
        <span className="text-[0.84rem] font-semibold text-primary">투자 계좌</span>
        <Button size="sm" onClick={() => setAccountModal({ open: true, mode: 'add' })}>계좌 추가</Button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
        {accounts.length === 0 && <div className="text-[0.78rem] text-muted">투자 계좌가 없습니다. 계좌를 먼저 추가하세요.</div>}
        {accounts.map((a) => {
          const dleft = daysUntil(a.maturityDate);
          const near = dleft !== null && dleft >= 0 && dleft <= 30;
          const matured = dleft !== null && dleft < 0;
          return (
          <div key={a.id} className="border border-border rounded-[var(--radius-lg)] p-3.5 bg-background">
            <div className="flex justify-between items-baseline gap-2">
              <span className="font-semibold text-[0.95rem]">{a.name}</span>
              <span className="font-bold text-[0.95rem] [font-family:var(--font-mono)]">{won(a.cashBalance)}</span>
            </div>
            <div className="text-[0.72rem] text-muted mt-1">원화 예수금 · 보유 {a.holdingsCount}종목 · 평가금액 {won(a.totalCurrentValue)}</div>
            {a.cashBalanceUsd > 0 && (
              <div className="text-[0.72rem] text-muted mt-0.5">달러 예수금 · ${a.cashBalanceUsd.toLocaleString('en-US')}</div>
            )}
            {a.accountNumber && <div className="text-[0.72rem] text-muted mt-0.5 font-mono">{a.accountNumber}</div>}
            {a.maturityDate && (
              <div className={`text-[0.72rem] mt-0.5 ${near || matured ? 'savings-meta-value warning' : 'text-muted'}`}>
                만기 {dotDate(a.maturityDate)}{near && ` ⚠️ D-${dleft}`}{matured && ' 만기됨'}
              </div>
            )}
            {a.memo && <div className="text-[0.72rem] text-muted mt-0.5">{a.memo}</div>}
            <div className="flex gap-2 mt-2.5">
              <Button variant="ghost" size="sm" className="flex-1" onClick={() => setExchangeModal({ open: true, account: a })}>환전</Button>
              <Button variant="ghost" size="sm" className="flex-1" onClick={() => setAccountModal({ open: true, mode: 'edit', editing: a })}>수정</Button>
              <Button variant="danger" size="sm" className="flex-1" onClick={() => handleRemoveAccount(a.id)}>삭제</Button>
            </div>
          </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between mb-2">
        <span className="text-[0.84rem] font-semibold text-primary">🔁 반복매수 자동화</span>
        <Button size="sm" variant="ghost" onClick={() => setRecurringModal({ open: true })}>+ 설정 추가</Button>
      </div>
      <div className="border border-border rounded-[var(--radius-lg)] bg-background px-3.5 py-2 mb-6">
        {recurringSchedules.length === 0 && <div className="text-[0.72rem] text-muted py-2">등록된 반복매수 설정이 없습니다.</div>}
        {recurringSchedules.map((s) => {
          const inv = rows.find((r) => r.id === s.investmentId);
          const isForeign = inv?.type === 'foreign_stock' || inv?.type === 'foreign_etf';
          return (
            <div className="py-2.5 border-b border-border-subtle last:border-b-0 flex items-center justify-between gap-2" key={s.id}>
              <div className="min-w-0">
                <div className="text-[0.84rem] font-medium flex items-center gap-1.5">
                  {s.investmentName ?? `#${s.investmentId}`}
                  {!s.active && <Badge tone="neutral">일시정지</Badge>}
                </div>
                <div className="text-[0.72rem] text-muted">
                  {recurringBuyLabel(s, isForeign)}
                  {s.nextRunDate && ` · 다음 ${s.nextRunDate}`}
                </div>
              </div>
              <div className="flex gap-1 shrink-0">
                <Button size="sm" variant="ghost" onClick={() => handleToggleRecurring(s.id)}>{s.active ? '일시정지' : '재개'}</Button>
                <Button size="sm" variant="ghost" onClick={() => setRecurringModal({ open: true, editing: s })}>수정</Button>
                <Button size="sm" variant="danger" onClick={() => handleRemoveRecurring(s.id)}>삭제</Button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-surface border border-border rounded-[var(--radius-lg)] px-5 py-4 flex flex-col gap-3 mb-4">
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
            <SearchInput label="종목명 검색" className="flex-1 min-w-0" placeholder="종목명 검색..." value={pendingName} onChange={(ev) => setPendingName(ev.target.value)} onEnter={handleSearch} />
            <Button onClick={handleSearch}>조회</Button>
          </div>
          <Button variant="ghost" className="w-full md:w-auto" onClick={handleReset}>초기화</Button>
        </div>
      </div>

      <div className="mb-2">
        <div className="flex items-center justify-between">
          <span className="text-[0.78rem] text-secondary">총 {total}건</span>
          <div className="flex items-center gap-2">
            {hasForeign && (
              <div className="hidden md:block">
                <Segmented
                  label="통화"
                  variant="joined"
                  value={currency}
                  onChange={setCurrency}
                  items={[{ value: 'USD', label: '$ USD' }, { value: 'KRW', label: '₩ KRW' }]}
                />
              </div>
            )}
            <Button variant="danger" disabled={selected.size === 0} onClick={handleRemoveSelected}>선택삭제</Button>
            <LimitSelect limit={limit} onLimitChange={changeLimit} />
          </div>
        </div>
        {hasForeign && (
          <div className="flex justify-end mt-1.5 md:hidden">
            <Segmented
              label="통화"
              variant="joined"
              value={currency}
              onChange={setCurrency}
              items={[{ value: 'USD', label: '$ USD' }, { value: 'KRW', label: '₩ KRW' }]}
            />
          </div>
        )}
      </div>

      <Card clip className="mb-6">
        <div className="table-wrap max-md:hidden">
          <table>
            <colgroup>
              <col style={{ width: '40px' }} />
              <col style={{ width: '110px' }} />
              <col style={{ width: '130px' }} />
              <col />
              <col style={{ width: '120px' }} />
              <col style={{ width: '120px' }} />
              <col style={{ width: '120px' }} />
              <col style={{ width: '96px' }} />
              <col style={{ width: '180px' }} />
              <col style={{ width: '128px' }} />
              <col style={{ width: '72px' }} />
            </colgroup>
            <thead>
              <tr>
                <th className="td-center"><input type="checkbox" className="checkbox" checked={allChecked} onChange={toggleAll} aria-label="전체선택" /></th>
                <th>계좌</th><th>유형</th><th>종목</th>
                <th>투자원금</th><th>평가금액</th>
                <th>수익</th><th>수익률</th>
                <th>메모</th><th>매수/매도</th><th>관리</th>
              </tr>
            </thead>
            <tbody>
              {paged.length === 0 && <TableEmptyRow colSpan={11} message="투자 항목이 없습니다." />}
              {paged.map((row) => {
                const recurringSchedule = scheduleByInvestmentId.get(row.id);
                const recurring = recurringSchedule ? recurringBuyLabel(recurringSchedule, row.type === 'foreign_stock' || row.type === 'foreign_etf') : null;
                const profit = fmtProfit(row);
                return (
                  <tr key={row.id}>
                    <td className="td-center"><input type="checkbox" className="checkbox" checked={selected.has(row.id)} onChange={() => toggle(row.id)} aria-label="선택" /></td>
                    <td className="td-center td-muted">{accountMap.get(row.accountId)?.name ?? '-'}</td>
                    <td className="td-center"><span className="cat-chip">{INVEST_TYPE_LABEL[row.type]}</span></td>
                    <td className="td-strong">{recurring && <span className="cursor-default" title={`반복매수 · ${recurring}`}>🔁 </span>}{row.name}</td>
                    <td className="td-mono td-right">{fmtPrincipal(row)}</td>
                    <td className="td-mono td-right">{fmtCurrentValue(row)}</td>
                    <td className={`td-right amount-${profit.up ? 'income' : 'expense'}`}>{profit.text}</td>
                    <td className="td-center"><span className={`return-pill ${profit.up ? 'up' : 'down'}`}>{profit.up ? '+' : ''}{row.profitRate}%</span></td>
                    <td className="td-center td-muted">{row.memo ?? '-'}</td>
                    <td className="td-center">
                      <div className="flex justify-center gap-1.5">
                        <Button size="sm" variant="ghost" onClick={() => setTrade({ open: true, mode: 'buy', target: row })}>매수</Button>
                        <Button size="sm" variant="ghost" onClick={() => setTrade({ open: true, mode: 'sell', target: row })}>매도</Button>
                        {row.symbol && <Button size="sm" variant="ghost" onClick={() => setPriceLookup({ open: true, target: row })}>시세조회</Button>}
                      </div>
                    </td>
                    <td className="td-center"><RowActions onEdit={() => setModal({ open: true, mode: 'edit', editing: row })} onDelete={() => handleRemove(row.id)} onCopy={() => handleDuplicate(row)} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className={TXCARDS}>
          {paged.length === 0 && <EmptyState message="투자 항목이 없습니다." />}
          {paged.map((row) => {
            const recurringSchedule = scheduleByInvestmentId.get(row.id);
            const recurring = recurringSchedule ? recurringBuyLabel(recurringSchedule, row.type === 'foreign_stock' || row.type === 'foreign_etf') : null;
            const profit = fmtProfit(row);
            return (
              <div className={TXCARD} key={row.id}>
                <div className="flex items-center gap-2 mb-1.5">
                  <input type="checkbox" className="checkbox" checked={selected.has(row.id)} onChange={() => toggle(row.id)} aria-label="선택" />
                  <div className="flex-1 flex justify-between items-baseline gap-2.5">
                    <span className={TXCARD_TITLE}>{recurring && '🔁 '}{row.name}</span>
                    <span className={TXCARD_AMT}>{fmtCurrentValue(row)}</span>
                  </div>
                </div>
                <div className="mt-2 pt-2 border-t border-border flex flex-col gap-1.5 text-[0.78rem]">
                  {[
                    { label: '유형', value: <span className="cat-chip">{INVEST_TYPE_LABEL[row.type]}</span> },
                    { label: '계좌', value: accountMap.get(row.accountId)?.name ?? '-' },
                    { label: '원금', value: fmtPrincipal(row) },
                    { label: '수익', value: <span className={profit.up ? 'text-accent' : 'text-danger'}>{profit.text}</span> },
                    { label: '수익률', value: <span className={`return-pill ${profit.up ? 'up' : 'down'}`}>{profit.up ? '+' : ''}{row.profitRate}%</span> },
                    ...(recurring ? [{ label: '반복매수', value: recurring }] : []),
                    ...(row.memo ? [{ label: '메모', value: row.memo }] : []),
                  ].map(({ label, value }) => (
                    <div key={label} className="flex gap-2">
                      <span className="text-muted w-16 shrink-0">{label}</span>
                      <span>{value}</span>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 mt-2">
                  <Button variant="ghost" className="flex-1" onClick={() => setTrade({ open: true, mode: 'buy', target: row })}>매수</Button>
                  <Button variant="ghost" className="flex-1" onClick={() => setTrade({ open: true, mode: 'sell', target: row })}>매도</Button>
                </div>
                {row.symbol && <Button variant="ghost" className="w-full mt-2" onClick={() => setPriceLookup({ open: true, target: row })}>시세조회</Button>}
                <CardActions onEdit={() => setModal({ open: true, mode: 'edit', editing: row })} onDelete={() => handleRemove(row.id)} onCopy={() => handleDuplicate(row)} />
              </div>
            );
          })}
        </div>
        <Pagination page={page} totalPages={totalPages} totalItems={total} onPageChange={setPage} />
      </Card>

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

// 예수금↔평가금액 전환(매수/매도) 모달 — 금액만 입력받아 /investments/:id/buy|sell 호출. 한도는 종목이 속한 계좌의 예수금 기준
// 매수/매도 — 수량 기준 입력. 단가는 종목코드가 있으면 시세조회로 자동입력(수정 가능), 없으면(가상자산 등) 직접 입력
function TradeModal({ state, accountMap, onClose, onSaved }: { state: TradeState; accountMap: Map<number, InvestmentAccount>; onClose: () => void; onSaved: () => void }) {
  const t = state.target;
  const account = t ? accountMap.get(t.accountId) : undefined;
  const isForeign = t?.type === 'foreign_stock' || t?.type === 'foreign_etf';
  const [quantity, setQuantity] = useState('');
  const [price, setPrice] = useState('');
  const [priceLoading, setPriceLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const { errors, setErrors, clearError, reset } = useFormErrors();
  const isBuy = state.mode === 'buy';
  const cashLimit = isForeign ? (account?.cashBalanceUsd ?? 0) : (account?.cashBalance ?? 0);

  useEffect(() => {
    if (!state.open || !t) return;
    reset();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 모달 열릴 때 폼 초기화
    setQuantity('');
    setPrice('');
    if (t.symbol) {
      setPriceLoading(true);
      api.get<{ price: number; currency: 'KRW' | 'USD'; krwPrice: number }>(`/investments/${t.id}/quote`)
        .then((r) => setPrice(String(r.currency === 'USD' ? r.price : Math.round(r.krwPrice))))
        .catch((err) => notify.error((err as Error).message || '시세 조회에 실패했습니다.'))
        .finally(() => setPriceLoading(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 모달 열림/대상 변경 시에만 초기화
  }, [state.open, t]);

  const amount = quantity && price ? Number(quantity) * Number(price) : 0;

  function validate() {
    const err: Record<string, string> = {};
    if (!quantity || Number(quantity) <= 0) err.quantity = '수량을 입력하세요.';
    else if (!isBuy && t?.quantity !== null && t?.quantity !== undefined && Number(quantity) > t.quantity) {
      err.quantity = '보유수량을 초과했습니다.';
    }
    if (!price || Number(price) <= 0) err.price = '단가를 입력하세요.';
    if (isBuy && amount > cashLimit) err.quantity = isForeign ? '달러 예수금을 초과했습니다.' : '예수금을 초과했습니다.';
    setErrors(err);
    return !Object.keys(err).length;
  }

  async function handleSave() {
    if (!t || !validate()) return;
    setSaving(true);
    try {
      await api.post(`/investments/${t.id}/${isBuy ? 'buy' : 'sell'}`, { quantity: Number(quantity), price: Number(price) });
      notify.success(isBuy ? '매수했습니다.' : '매도했습니다.');
      onSaved();
    } catch (err) {
      notify.error((err as Error).message || '처리에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={state.open} onClose={onClose} title={`${t?.name ?? ''} ${isBuy ? '매수' : '매도'}`} footer={<ModalFooter onClose={onClose} onSave={handleSave} saving={saving} />}>
      <Field label={isBuy ? '수량' : `수량 — 보유 ${t?.quantity ?? 0}개 이내`} required error={errors.quantity}>
        <input type="number" className="input" placeholder="0" value={quantity} onChange={(ev) => { setQuantity(ev.target.value); clearError('quantity'); }} />
      </Field>
      <Field label={t?.symbol ? `단가 (${isForeign ? '$' : '원'}) — 시세조회로 자동입력, 수정 가능` : `단가 (${isForeign ? '$' : '원'})`} required error={errors.price}>
        <input type="number" className="input" placeholder={priceLoading ? '조회 중...' : '0'} value={price} onChange={(ev) => { setPrice(ev.target.value); clearError('price'); }} />
      </Field>
      {amount > 0 && (
        <div className="text-[0.82rem] text-muted">
          {isBuy ? '필요 금액' : '환입 금액'}: {isForeign ? `$${amount.toLocaleString('en-US')}` : won(amount)}
          {isBuy && ` (계좌 예수금 ${isForeign ? `$${cashLimit.toLocaleString('en-US')}` : won(cashLimit)} 이내)`}
        </div>
      )}
    </Modal>
  );
}

// 시세조회 — 등록된 종목코드/티커로 단가 조회 + 저장된 보유수량을 곱한 평가금액을 백엔드가 바로 산출. 확인 후 반영 버튼 한 번으로 끝남(수량 재입력 없음)
function PriceLookupModal({ state, onClose, onSaved }: { state: PriceState; onClose: () => void; onSaved: () => void }) {
  const t = state.target;
  const [result, setResult] = useState<PriceLookupResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!state.open || !t) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 모달 열릴 때 조회 상태 초기화
    setResult(null);
    setLoading(true);
    api.get<PriceLookupResult>(`/investments/${t.id}/price`)
      .then(setResult)
      .catch((err) => notify.error((err as Error).message || '시세 조회에 실패했습니다.'))
      .finally(() => setLoading(false));
  }, [state.open, t]);

  async function handleApply() {
    if (!t || !result) return;
    setSaving(true);
    try {
      await api.put(`/investments/${t.id}`, { currentValue: result.evaluatedValue });
      notify.success('평가금액에 반영했습니다.');
      onSaved();
    } catch (err) {
      notify.error((err as Error).message || '반영에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={state.open} onClose={onClose} title={`${t?.name ?? ''} 시세조회`} footer={<ModalFooter onClose={onClose} onSave={handleApply} saving={saving} saveLabel="평가금액에 반영" saveDisabled={!result} />}>
      {loading && <PageLoading size="sm" message="조회 중..." />}
      {result && (
        <div className="text-[0.82rem] text-secondary space-y-1">
          <div>
            {result.name ?? t?.symbol} · 현재가 {result.currency === 'KRW' ? won(result.price) : `$${result.price.toLocaleString('en-US')}`}
            {result.currency !== 'KRW' && <> ({won(result.krwPrice)})</>}
          </div>
          <div>보유수량 {result.quantity.toLocaleString('ko-KR')}개</div>
          <div className="text-primary font-medium">반영될 평가금액: {won(result.evaluatedValue)}</div>
        </div>
      )}
    </Modal>
  );
}

function InvestModal({ state, accounts, onClose, onSaved }: { state: ModalState; accounts: InvestmentAccount[]; onClose: () => void; onSaved: () => void }) {
  const e = state.editing;
  const [accountId, setAccountId] = useState<number | ''>('');
  const [name, setName] = useState('');
  const [type, setType] = useState<InvestmentType>('domestic_stock');
  const [symbol, setSymbol] = useState('');
  const [quantity, setQuantity] = useState('');
  const [principal, setPrincipal] = useState('');
  const [currentValue, setCurrentValue] = useState('');
  const [profitHelperMode, setProfitHelperMode] = useState<'amount' | 'rate'>('amount');
  const [profitHelperValue, setProfitHelperValue] = useState('');
  const [purchaseDate, setPurchaseDate] = useState('');
  const [memo, setMemo] = useState('');
  const [saving, setSaving] = useState(false);
  const { errors, setErrors, setError, clearError, reset } = useFormErrors();
  const isForeign = type === 'foreign_stock' || type === 'foreign_etf';

  useEffect(() => {
    if (!state.open) return;
    reset();
    const src = e ?? state.prefill;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 모달 열릴 때 폼 초기화
    setAccountId(src?.accountId ?? accounts[0]?.id ?? '');
    setName(src?.name ?? '');
    setType(src?.type ?? 'domestic_stock');
    setSymbol(src?.symbol ?? '');
    setQuantity(src?.quantity ? String(src.quantity) : '');
    const srcIsForeign = src?.type === 'foreign_stock' || src?.type === 'foreign_etf';
    setPrincipal(src ? String(srcIsForeign && src.principalUsd !== null ? src.principalUsd : src.principal) : '');
    setCurrentValue(src ? String(srcIsForeign && src.currentValueUsd !== null ? src.currentValueUsd : src.currentValue) : '');
    setProfitHelperMode('amount');
    setProfitHelperValue('');
    setPurchaseDate(e?.purchaseDate ?? (state.prefill ? toDay() : ''));
    setMemo(src?.memo ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 모달 열림/수정대상 변경 시에만 폼 초기화
  }, [state.open, e, state.prefill]);

  // 현재 평가금액 + 수익(원 또는 %)으로 투자원금 역산 — "390,000원(+19,000원)"처럼 평가금액·수익만 아는 경우 보조
  function applyProfitHelper() {
    const cv = Number(currentValue);
    const helper = Number(profitHelperValue);
    if (!currentValue || !Number.isFinite(cv)) {
      setError('profitHelper', '먼저 현재 평가금액을 입력하세요.');
      return;
    }
    if (!profitHelperValue || !Number.isFinite(helper)) {
      setError('profitHelper', '수익 값을 입력하세요.');
      return;
    }
    const computed = profitHelperMode === 'amount' ? cv - helper : cv / (1 + helper / 100);
    setPrincipal(String(Math.round(computed)));
    clearError('principal');
    clearError('profitHelper');
  }

  function validate() {
    const err: Record<string, string> = {};
    if (!accountId) err.accountId = '계좌를 선택하세요.';
    if (!name.trim()) err.name = '종목명을 입력하세요.';
    if (!principal || Number(principal) <= 0) err.principal = '투자원금을 입력하세요.';
    if (!currentValue || Number(currentValue) < 0) err.currentValue = '현재 평가금액을 입력하세요.';
    setErrors(err);
    return !Object.keys(err).length;
  }

  async function handleSave() {
    if (!validate()) return;
    setSaving(true);
    try {
      const payload = {
        accountId, name, type, symbol: symbol || undefined, quantity: quantity ? Number(quantity) : undefined,
        principal: Number(principal || 0), currentValue: Number(currentValue || 0), purchaseDate: purchaseDate || undefined, memo: memo || undefined,
      };
      if (state.mode === 'edit' && e) await api.put(`/investments/${e.id}`, payload);
      else await api.post('/investments', payload);
      notify.upserted(state.mode, '투자 항목');
      onSaved();
    } catch {
      notify.saveFailed();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={state.open} onClose={onClose} title={state.mode === 'edit' ? '투자 항목 수정' : '투자 항목 추가'} footer={<ModalFooter onClose={onClose} onSave={handleSave} saving={saving} />}>
      <Field label="계좌" required error={errors.accountId}>
        <select className="input" value={accountId} onChange={(ev) => { setAccountId(ev.target.value ? Number(ev.target.value) : ''); clearError('accountId'); }}>
          <option value="" disabled>계좌 선택</option>
          {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </Field>
      <Field label="종목명" required error={errors.name}>
        <input type="text" className="input" placeholder="예: 삼성전자" value={name} onChange={(ev) => { setName(ev.target.value); clearError('name'); }} />
      </Field>
      <Field label="유형" required>
        <select className="input" value={type} onChange={(ev) => setType(ev.target.value as InvestmentType)}>
          <option value="domestic_stock">국내주식</option><option value="foreign_stock">해외주식</option><option value="foreign_etf">해외ETF</option>
          <option value="domestic_etf">국내ETF</option><option value="crypto">가상자산</option><option value="etc">기타</option>
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-4 max-md:grid-cols-1">
        <Field label="종목코드/티커 (선택)" error={errors.symbol}>
          <input type="text" className="input" placeholder="국내: 005930, 해외: AAPL" value={symbol} onChange={(ev) => { setSymbol(ev.target.value); clearError('symbol'); }} />
        </Field>
        <Field label="보유수량 (선택)">
          <input type="number" className="input" placeholder="시세조회에 사용" value={quantity} onChange={(ev) => setQuantity(ev.target.value)} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-4 max-md:grid-cols-1">
        <Field label={`투자원금 (${isForeign ? '달러 $' : '원'})`} required error={errors.principal}>
          <input type="number" className="input" placeholder="0" value={principal} onChange={(ev) => { setPrincipal(ev.target.value); clearError('principal'); }} />
        </Field>
        <Field label={`현재 평가금액 (${isForeign ? '달러 $' : '원'})`} required error={errors.currentValue}>
          <input type="number" className="input" placeholder="매수 당일엔 투자원금과 동일" value={currentValue} onChange={(ev) => { setCurrentValue(ev.target.value); clearError('currentValue'); }} />
        </Field>
      </div>
      <div className="bg-background border border-border rounded-[var(--radius-md)] p-3 -mt-1 mb-1">
        <div className="text-[0.78rem] text-secondary mb-1.5">이미 투자중인 종목이라 투자원금을 모를 때 — 현재 평가금액과 수익을 입력하면 투자원금을 계산해줍니다.</div>
        <div className="flex gap-2 items-start max-md:flex-wrap">
          <select className="input w-auto" value={profitHelperMode} onChange={(ev) => setProfitHelperMode(ev.target.value as 'amount' | 'rate')}>
            <option value="amount">수익(원)</option>
            <option value="rate">수익률(%)</option>
          </select>
          <input
            type="number" className="input" aria-invalid={!!errors.profitHelper}
            placeholder={profitHelperMode === 'amount' ? '예: 19000 (손실은 음수)' : '예: 5.1 (손실은 음수)'}
            value={profitHelperValue} onChange={(ev) => { setProfitHelperValue(ev.target.value); clearError('profitHelper'); }}
          />
          <Button type="button" variant="ghost" size="sm" onClick={applyProfitHelper}>투자원금 계산</Button>
        </div>
        {errors.profitHelper && <div className="text-[0.74rem] text-danger mt-1">{errors.profitHelper}</div>}
      </div>
      <Field label="최초 매수일" error={errors.purchaseDate}><input type="date" className="input" aria-label="최초 매수일" value={purchaseDate} onChange={(ev) => setPurchaseDate(ev.target.value)} /></Field>
      <Field label="메모 (선택)"><input type="text" className="input" placeholder="투자 전략, 목표가 등" value={memo} onChange={(ev) => setMemo(ev.target.value)} /></Field>
    </Modal>
  );
}

// 투자 계좌 추가/수정 모달 — 이름·예수금·계좌번호·메모 입력. 계좌번호는 서버에 암호화 저장되며 목록엔 마스킹되어 표시되므로, 수정 시엔 비워두면 기존 값 유지
function AccountModal({ state, onClose, onSaved }: { state: AccountModalState; onClose: () => void; onSaved: () => void }) {
  const e = state.editing;
  const isEdit = state.mode === 'edit';
  const [name, setName] = useState('');
  const [cashBalance, setCashBalance] = useState('');
  const [cashBalanceUsd, setCashBalanceUsd] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [startDate, setStartDate] = useState('');
  const [maturityDate, setMaturityDate] = useState('');
  const [memo, setMemo] = useState('');
  const [saving, setSaving] = useState(false);
  const { errors, setErrors, clearError, reset } = useFormErrors();

  useEffect(() => {
    if (!state.open) return;
    reset();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 모달 열릴 때 폼 초기화
    setName(e?.name ?? '');
    setCashBalance(e ? String(e.cashBalance) : '');
    setCashBalanceUsd(e ? String(e.cashBalanceUsd) : '');
    setAccountNumber('');
    setStartDate(e?.startDate ?? '');
    setMaturityDate(e?.maturityDate ?? '');
    setMemo(e?.memo ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 모달 열림/수정대상 변경 시에만 폼 초기화
  }, [state.open, e]);

  function validate() {
    const err: Record<string, string> = {};
    if (!name.trim()) err.name = '계좌명을 입력하세요.';
    // 수정 시엔 비워두면 기존 암호화된 번호를 유지하므로 신규 생성일 때만 필수
    if (!isEdit && !accountNumber.trim()) err.accountNumber = '계좌번호를 입력하세요.';
    setErrors(err);
    return !Object.keys(err).length;
  }

  async function handleSave() {
    if (!validate()) return;
    setSaving(true);
    try {
      const payload = {
        name, cashBalance: Number(cashBalance || 0), cashBalanceUsd: Number(cashBalanceUsd || 0),
        accountNumber: accountNumber || undefined,
        startDate: startDate || undefined, maturityDate: maturityDate || undefined,
        memo: memo || undefined,
      };
      if (state.mode === 'edit' && e) await api.put(`/investment-accounts/${e.id}`, payload);
      else await api.post('/investment-accounts', payload);
      notify.upserted(state.mode, '투자 계좌');
      onSaved();
    } catch {
      notify.saveFailed();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={state.open} onClose={onClose} title={state.mode === 'edit' ? '투자 계좌 수정' : '투자 계좌 추가'} footer={<ModalFooter onClose={onClose} onSave={handleSave} saving={saving} />}>
      <Field label="계좌명" required error={errors.name}>
        <input type="text" className="input" placeholder="예: ISA, 일반위탁" value={name} onChange={(ev) => { setName(ev.target.value); clearError('name'); }} />
      </Field>
      <div className="grid grid-cols-2 gap-4 max-md:grid-cols-1">
        <Field label="원화 예수금 (원)"><input type="number" className="input" placeholder="0" value={cashBalance} onChange={(ev) => setCashBalance(ev.target.value)} /></Field>
        <Field label="달러 예수금 ($)"><input type="number" className="input" placeholder="0" value={cashBalanceUsd} onChange={(ev) => setCashBalanceUsd(ev.target.value)} /></Field>
      </div>
      <Field label={isEdit ? '계좌번호 (변경 시에만 입력)' : '계좌번호'} required={!isEdit} error={errors.accountNumber}>
        <input type="text" className="input" placeholder={isEdit ? '비워두면 기존 번호 유지' : '동일 계좌명 다중 보유 시 구분용'} value={accountNumber} onChange={(ev) => { setAccountNumber(ev.target.value); clearError('accountNumber'); }} />
      </Field>
      <div className="grid grid-cols-2 gap-4 max-md:grid-cols-1">
        <Field label="가입일 (선택, ISA 등)"><input type="date" className="input" aria-label="가입일" value={startDate} onChange={(ev) => setStartDate(ev.target.value)} /></Field>
        <Field label="만기일 (선택)"><input type="date" className="input" aria-label="만기일" value={maturityDate} onChange={(ev) => setMaturityDate(ev.target.value)} /></Field>
      </div>
      {!isEdit && <div className="text-[0.78rem] text-muted -mt-1">만기일을 비워두면 ISA 기본 가입 기간(가입일 + 3년)으로 자동 계산됩니다.</div>}
      <Field label="메모 (선택)"><input type="text" className="input" placeholder="추가 메모" value={memo} onChange={(ev) => setMemo(ev.target.value)} /></Field>
    </Modal>
  );
}

// 환전 모달 — 계좌 내 원화↔달러 예수금 상호 전환. 환율 미입력 시 서버가 실시간 조회(frankfurter.app)
function ExchangeModal({ state, onClose, onSaved }: { state: ExchangeModalState; onClose: () => void; onSaved: () => void }) {
  const a = state.account;
  const [direction, setDirection] = useState<'krw_to_usd' | 'usd_to_krw'>('krw_to_usd');
  const [amount, setAmount] = useState('');
  const [rate, setRate] = useState('');
  const [saving, setSaving] = useState(false);
  const { errors, setErrors, clearError, reset } = useFormErrors();

  useEffect(() => {
    if (!state.open) return;
    reset();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 모달 열릴 때 폼 초기화
    setDirection('krw_to_usd');
    setAmount('');
    setRate('');
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 모달 열림 시에만 폼 초기화
  }, [state.open]);

  const fromLabel = direction === 'krw_to_usd' ? '원화' : '달러';
  const toLabel = direction === 'krw_to_usd' ? '달러' : '원화';
  const available = a ? (direction === 'krw_to_usd' ? a.cashBalance : a.cashBalanceUsd) : 0;

  function validate() {
    const err: Record<string, string> = {};
    if (!amount || Number(amount) <= 0) err.amount = `${fromLabel} 환전 금액을 입력하세요.`;
    setErrors(err);
    return !Object.keys(err).length;
  }

  async function handleSave() {
    if (!a || !validate()) return;
    setSaving(true);
    try {
      await api.post(`/investment-accounts/${a.id}/exchange`, {
        direction, amount: Number(amount), rate: rate ? Number(rate) : undefined,
      });
      notify.success('환전이 반영되었습니다.');
      onSaved();
    } catch {
      notify.saveFailed();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={state.open} onClose={onClose} title={`환전 — ${a?.name ?? ''}`} footer={<ModalFooter onClose={onClose} onSave={handleSave} saving={saving} />}>
      <Field label="환전 방향">
        <select className="input" value={direction} onChange={(ev) => setDirection(ev.target.value as 'krw_to_usd' | 'usd_to_krw')}>
          <option value="krw_to_usd">원화 → 달러</option>
          <option value="usd_to_krw">달러 → 원화</option>
        </select>
      </Field>
      <Field label={`${fromLabel} 환전 금액 (보유 ${direction === 'krw_to_usd' ? won(available) : `$${available.toLocaleString('en-US')}`})`} required error={errors.amount}>
        <input
          type="number" className="input"
          placeholder={direction === 'krw_to_usd' ? '예: 1000000' : '예: 100'}
          value={amount} onChange={(ev) => { setAmount(ev.target.value); clearError('amount'); }}
        />
      </Field>
      <Field label="환율 (1달러당 원화, 선택)">
        <input type="number" className="input" placeholder="미입력 시 실시간 환율 적용" value={rate} onChange={(ev) => setRate(ev.target.value)} />
      </Field>
      <p className="text-[0.78rem] text-muted">{fromLabel} 예수금에서 차감되어 {toLabel} 예수금으로 환산되어 더해집니다.</p>
    </Modal>
  );
}

// 반복매수 자동이체 설정 모달 — "데이터는 그냥 생성만" 원칙에 따라 종목 등록 모달과 완전히 분리.
// 이미 등록된 종목 중 하나를 골라 반복 규칙만 설정 — 저장 시 매수는 하지 않고 RecurringSchedule만 생성/수정한다.
function RecurringInvestmentModal({ state, onClose, onSaved }: { state: RecurringModalState; onClose: () => void; onSaved: () => void }) {
  const r = state.editing;
  const investmentsQuery = useApiQuery<Investment[]>(['investments', 'all-for-recurring'], '/investments', { enabled: state.open });
  const investments = investmentsQuery.data ?? [];
  const [investmentId, setInvestmentId] = useState<number | ''>('');
  const [startDate, setStartDate] = useState('');
  const [active, setActive] = useState(true);
  const [recurringCycle, setRecurringCycle] = useState<RecurringCycle>('monthly');
  const [recurringDay, setRecurringDay] = useState(1);
  const [recurringMonth, setRecurringMonth] = useState(1);
  const [weekendAdjust, setWeekendAdjust] = useState<WeekendAdjust>('none');
  const [recurringMode, setRecurringMode] = useState<'amount' | 'quantity'>('amount');
  const [recurringAmount, setRecurringAmount] = useState('');
  const [recurringQuantity, setRecurringQuantity] = useState('');
  const [saving, setSaving] = useState(false);
  const { errors, setErrors, clearError, reset } = useFormErrors();

  const selected = investments.find((v) => v.id === investmentId);
  const isForeign = selected?.type === 'foreign_stock' || selected?.type === 'foreign_etf';

  useEffect(() => {
    if (!state.open) return;
    reset();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 모달 열릴 때 폼 초기화
    setInvestmentId(r?.investmentId ?? '');
    setStartDate(r?.startDate ?? localDate());
    setActive(r?.active ?? true);
    setRecurringCycle(r?.rule?.cycle ?? 'monthly');
    setRecurringDay(r?.rule?.day ?? 1);
    setRecurringMonth(r?.rule?.month ?? 1);
    setWeekendAdjust(r?.rule?.weekendAdjust ?? 'none');
    setRecurringMode(r?.buyQuantity ? 'quantity' : 'amount');
    setRecurringAmount(r?.buyAmount ? String(r.buyAmount) : '');
    setRecurringQuantity(r?.buyQuantity ? String(r.buyQuantity) : '');
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 모달 열림/수정대상 변경 시에만 폼 초기화
  }, [state.open, r]);

  function validate() {
    const err: Record<string, string> = {};
    if (!investmentId) err.investmentId = '대상 종목을 선택하세요.';
    else if (!selected?.symbol) err.investmentId = '종목코드/티커가 없는 종목은 반복매수를 설정할 수 없습니다.';
    if (!startDate) err.startDate = '시작일을 선택하세요.';
    if (recurringMode === 'amount') {
      if (!recurringAmount || Number(recurringAmount) <= 0) err.recurringAmount = '회차당 매수금액을 입력하세요.';
    } else if (!recurringQuantity || Number(recurringQuantity) <= 0) {
      err.recurringQuantity = '회차당 매수수량을 입력하세요.';
    }
    setErrors(err);
    return !Object.keys(err).length;
  }

  async function handleSave() {
    if (!validate()) return;
    setSaving(true);
    try {
      const payload = {
        kind: 'investment' as const,
        investmentId,
        startDate,
        active,
        rule: { cycle: recurringCycle, day: recurringDay, month: recurringCycle === 'yearly' ? recurringMonth : undefined, weekendAdjust },
        buyAmount: recurringMode === 'amount' && recurringAmount ? Number(recurringAmount) : undefined,
        buyQuantity: recurringMode === 'quantity' && recurringQuantity ? Number(recurringQuantity) : undefined,
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
    <Modal open={state.open} onClose={onClose} title={r ? '반복매수 설정 수정' : '반복매수 설정 추가'} footer={<ModalFooter onClose={onClose} onSave={handleSave} saving={saving} />}>
      <Field label="대상 종목" required error={errors.investmentId}>
        <select className="input" value={investmentId} onChange={(ev) => { setInvestmentId(ev.target.value ? Number(ev.target.value) : ''); clearError('investmentId'); }}>
          <option value="" disabled>종목 선택</option>
          {investments.map((v) => (
            <option key={v.id} value={v.id} disabled={!v.symbol}>{v.name}{v.symbol ? ` (${v.symbol})` : ' — 종목코드 없음'}</option>
          ))}
        </select>
      </Field>
      <div className="text-[0.78rem] text-muted -mt-1">종목코드/티커 기준으로 회차를 계산해, 그 시점 실시간 시세로 자동 매수합니다.</div>
      <Field label="시작일" required error={errors.startDate}>
        <input type="date" className="input" value={startDate} onChange={(ev) => { setStartDate(ev.target.value); clearError('startDate'); }} />
      </Field>
      <div className="grid grid-cols-2 gap-4 max-md:grid-cols-1">
        <Field label="반복 주기" required>
          <select className="input" value={recurringCycle} onChange={(ev) => setRecurringCycle(ev.target.value as RecurringCycle)}>
            <option value="daily">매일</option>
            <option value="monthly">매월</option>
            <option value="weekly">매주</option>
            <option value="yearly">매년</option>
          </select>
        </Field>
        {recurringCycle === 'weekly' ? (
          <Field label="요일" required>
            <select className="input" value={recurringDay} onChange={(ev) => setRecurringDay(Number(ev.target.value))}>
              {WEEKDAY_LABEL.map((label, d) => <option key={d} value={d}>{label}요일</option>)}
            </select>
          </Field>
        ) : recurringCycle === 'daily' ? (
          <Field label="안내">
            <div className="text-[0.82rem] text-secondary py-2">평일(월~금)에만 매수됩니다.</div>
          </Field>
        ) : (
          <Field label="기준일" required>
            <select className="input" value={recurringDay} onChange={(ev) => setRecurringDay(Number(ev.target.value))}>
              {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                <option key={d} value={d}>{d}일</option>
              ))}
            </select>
          </Field>
        )}
      </div>
      {recurringCycle === 'yearly' && (
        <Field label="월" required>
          <select className="input" value={recurringMonth} onChange={(ev) => setRecurringMonth(Number(ev.target.value))}>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => <option key={m} value={m}>{m}월</option>)}
          </select>
        </Field>
      )}
      <Field label="회차당 매수 기준" required>
        <select className="input" value={recurringMode} onChange={(ev) => setRecurringMode(ev.target.value as 'amount' | 'quantity')}>
          <option value="amount">금액</option>
          <option value="quantity">수량(n주)</option>
        </select>
      </Field>
      {recurringMode === 'amount' ? (
        <Field label={`회차당 매수금액 (${isForeign ? '달러 $' : '원'})`} required error={errors.recurringAmount}>
          <input type="number" className="input" placeholder="0" value={recurringAmount} onChange={(ev) => { setRecurringAmount(ev.target.value); clearError('recurringAmount'); }} />
        </Field>
      ) : (
        <Field label="회차당 매수수량 (주)" required error={errors.recurringQuantity}>
          <input type="number" className="input" placeholder="0" value={recurringQuantity} onChange={(ev) => { setRecurringQuantity(ev.target.value); clearError('recurringQuantity'); }} />
        </Field>
      )}
      {recurringCycle !== 'weekly' && recurringCycle !== 'daily' && (
        <Field label="주말인 경우">
          <div className="flex gap-5 flex-wrap [&_label]:flex [&_label]:items-center [&_label]:gap-1.25 [&_label]:text-[0.82rem] [&_label]:text-secondary [&_label]:cursor-pointer [&_input]:accent-accent">
            <label><input type="radio" name="recurringInvestWeekendAdjust" value="none" checked={weekendAdjust === 'none'} onChange={() => setWeekendAdjust('none')} />조정 안 함</label>
            <label><input type="radio" name="recurringInvestWeekendAdjust" value="before" checked={weekendAdjust === 'before'} onChange={() => setWeekendAdjust('before')} />전 금요일</label>
            <label><input type="radio" name="recurringInvestWeekendAdjust" value="after" checked={weekendAdjust === 'after'} onChange={() => setWeekendAdjust('after')} />다음 월요일</label>
          </div>
        </Field>
      )}
      <label className="flex items-center gap-2 text-[0.875rem] font-medium text-primary cursor-pointer select-none">
        <input type="checkbox" className="checkbox" checked={active} onChange={(ev) => setActive(ev.target.checked)} />
        활성 (일시정지하면 새 회차를 매수하지 않음)
      </label>
    </Modal>
  );
}
