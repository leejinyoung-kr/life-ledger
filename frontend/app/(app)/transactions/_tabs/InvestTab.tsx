'use client';

import { useEffect, useMemo, useState } from 'react';
import StatCard from '@/components/StatCard';
import Modal from '@/components/Modal';
import Pagination, { LimitSelect } from '@/components/Pagination';
import Button from '@/components/ui/Button';
import { Field, ModalFooter } from '@/components/ui/Field';
import { useConfirm } from '@/components/ConfirmModal';
import { IconTrendUp, IconWon, IconChart, IconSearch } from '@/components/icons';
import { notify } from '@/lib/toast';
import { api } from '@/lib/api';
import { useApiQuery, useInvalidate, type Paginated } from '@/lib/query';
import { useFormErrors } from '@/lib/useFormErrors';
import { usePagination } from '@/lib/usePagination';
import { useRowSelection } from '@/lib/useRowSelection';
import { qk } from '@/lib/queryKeys';
import {
  INVEST_TYPE_LABEL, won,
  type Category, type Investment, type InvestmentAccount, type InvestmentSummary, type InvestmentType,
} from '@/lib/finance';
import {
  TABLE_CARD, TXCARDS, TXCARD, TXCARD_TITLE, TXCARD_AMT, TXCARD_SUB, TXCARD_EMPTY,
  RowActions, CardActions, toDay, useAddTrigger,
} from '../_shared';

type ModalState = { open: boolean; mode: 'add' | 'edit'; editing?: Investment; prefill?: Investment };
type TradeState = { open: boolean; mode: 'buy' | 'sell'; target?: Investment };
type AccountModalState = { open: boolean; mode: 'add' | 'edit'; editing?: InvestmentAccount };

// 평가금액 최근 갱신 경과일 — 30일 이상이면 신뢰도 낮음을 amber로 표시
function daysAgoLabel(updatedAt: string): { label: string; stale: boolean } {
  const days = Math.floor((Date.now() - new Date(updatedAt).getTime()) / (24 * 60 * 60 * 1000));
  const label = days <= 0 ? '오늘 갱신' : `${days}일 전`;
  return { label, stale: days >= 30 };
}

export default function InvestTab({ investCats, addTrigger }: { investCats: Category[]; addTrigger: number }) {
  const { page, setPage, limit, changeLimit } = usePagination();
  const { confirm, confirmElement } = useConfirm();
  const [modal, setModal] = useState<ModalState>({ open: false, mode: 'add' });
  const [trade, setTrade] = useState<TradeState>({ open: false, mode: 'buy' });
  const [accountModal, setAccountModal] = useState<AccountModalState>({ open: false, mode: 'add' });
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
  // 자산이동/매수/매도가 계좌 예수금도 바꿀 수 있어 계좌 쿼리도 함께 무효화
  const reload = () => invalidate(qk.investments.all, qk.investmentAccounts.all);

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
        {accounts.map((a) => (
          <div key={a.id} className="border border-border rounded-[var(--radius-lg)] p-3.5 bg-background">
            <div className="flex justify-between items-baseline gap-2">
              <span className="font-semibold text-[0.95rem]">{a.name}</span>
              <span className="font-bold text-[0.95rem] [font-family:var(--font-mono)]">{won(a.cashBalance)}</span>
            </div>
            <div className="text-[0.72rem] text-muted mt-1">예수금 · 보유 {a.holdingsCount}종목 · 평가금액 {won(a.totalCurrentValue)}</div>
            {a.memo && <div className="text-[0.72rem] text-muted mt-0.5">{a.memo}</div>}
            <div className="flex gap-2 mt-2.5">
              <Button variant="ghost" size="sm" className="flex-1" onClick={() => setAccountModal({ open: true, mode: 'edit', editing: a })}>수정</Button>
              <Button variant="danger" size="sm" className="flex-1" onClick={() => handleRemoveAccount(a.id)}>삭제</Button>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-surface border border-border rounded-[var(--radius-lg)] px-5 py-4 flex flex-col gap-3 mb-4">
        <div className="flex gap-2 items-center max-md:flex-wrap">
          <select className="input w-auto min-w-[120px] shrink-0" value={pendingAccount} onChange={(ev) => setPendingAccount(ev.target.value)} aria-label="계좌 필터">
            <option value="">전체 계좌</option>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <select className="input w-auto min-w-[120px] shrink-0" value={pendingType} onChange={(ev) => setPendingType(ev.target.value)} aria-label="유형 필터">
            <option value="">전체 유형</option>
            {investCats.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
          </select>
          <div className="relative flex-1 min-w-[160px]">
            <IconSearch className="absolute left-[11px] top-1/2 -translate-y-1/2 text-muted w-[15px] h-[15px] pointer-events-none" />
            <input className="input pl-icon" type="text" placeholder="종목명 검색..." value={pendingName} onChange={(ev) => setPendingName(ev.target.value)} onKeyDown={(ev) => ev.key === 'Enter' && handleSearch()} aria-label="종목명 검색" />
          </div>
          <Button onClick={handleSearch}>조회</Button>
          <Button variant="ghost" onClick={handleReset}>초기화</Button>
        </div>
      </div>

      <div className="flex items-center justify-between mb-2">
        <span className="text-[0.78rem] text-secondary">총 {total}건</span>
        <div className="flex items-center gap-2">
          <Button variant="danger" disabled={selected.size === 0} onClick={handleRemoveSelected}>선택삭제</Button>
          <LimitSelect limit={limit} onLimitChange={changeLimit} />
        </div>
      </div>

      <div className={`${TABLE_CARD} mb-6`}>
        <div className="table-wrap max-md:hidden">
          <table>
            <colgroup>
              <col style={{ width: '40px' }} />
              <col style={{ width: '64px' }} />
              <col style={{ width: '110px' }} />
              <col style={{ width: '130px' }} />
              <col />
              <col style={{ width: '120px' }} />
              <col style={{ width: '120px' }} />
              <col style={{ width: '120px' }} />
              <col style={{ width: '96px' }} />
              <col style={{ width: '96px' }} />
              <col style={{ width: '180px' }} />
              <col style={{ width: '128px' }} />
              <col style={{ width: '72px' }} />
            </colgroup>
            <thead>
              <tr>
                <th className="td-center"><input type="checkbox" className="checkbox" checked={allChecked} onChange={toggleAll} aria-label="전체선택" /></th>
                <th>번호</th><th>계좌</th><th>유형</th><th>종목</th>
                <th>투자원금</th><th>평가금액</th>
                <th>수익</th><th>수익률</th><th>최근 갱신</th>
                <th>메모</th><th>매수/매도</th><th>관리</th>
              </tr>
            </thead>
            <tbody>
              {paged.length === 0 && <tr><td colSpan={13} className="td-center td-muted">투자 항목이 없습니다.</td></tr>}
              {paged.map((row, i) => {
                const up = row.profit >= 0;
                const updated = daysAgoLabel(row.updatedAt);
                return (
                  <tr key={row.id}>
                    <td className="td-center"><input type="checkbox" className="checkbox" checked={selected.has(row.id)} onChange={() => toggle(row.id)} aria-label="선택" /></td>
                    <td className="td-center td-muted">{total - (page - 1) * limit - i}</td>
                    <td className="td-center td-muted">{accountMap.get(row.accountId)?.name ?? '-'}</td>
                    <td className="td-center"><span className="cat-chip">{INVEST_TYPE_LABEL[row.type]}</span></td>
                    <td className="td-strong">{row.name}</td>
                    <td className="td-mono td-right">{won(row.principal)}</td>
                    <td className="td-mono td-right">{won(row.currentValue)}</td>
                    <td className={`td-right amount-${up ? 'income' : 'expense'}`}>{up ? '+' : '-'}{won(row.profit)}</td>
                    <td className="td-center"><span className={`return-pill ${up ? 'up' : 'down'}`}>{up ? '+' : ''}{row.profitRate}%</span></td>
                    <td className={`td-center ${updated.stale ? 'text-amber' : 'text-muted'}`}>{updated.label}</td>
                    <td className="td-center td-muted">{row.memo ?? '-'}</td>
                    <td className="td-center">
                      <div className="flex justify-center gap-1.5">
                        <Button size="sm" variant="ghost" onClick={() => setTrade({ open: true, mode: 'buy', target: row })}>매수</Button>
                        <Button size="sm" variant="ghost" onClick={() => setTrade({ open: true, mode: 'sell', target: row })}>매도</Button>
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
          {paged.length === 0 && <div className={TXCARD_EMPTY}>투자 항목이 없습니다.</div>}
          {paged.map((row) => {
            const up = row.profit >= 0;
            const updated = daysAgoLabel(row.updatedAt);
            return (
              <div className={TXCARD} key={row.id}>
                <div className="flex items-center gap-2 mb-1.5">
                  <input type="checkbox" className="checkbox" checked={selected.has(row.id)} onChange={() => toggle(row.id)} aria-label="선택" />
                  <div className="flex-1 flex justify-between items-baseline gap-2.5">
                    <span className={TXCARD_TITLE}>{row.name}</span>
                    <span className={TXCARD_AMT}>{won(row.currentValue)}</span>
                  </div>
                </div>
                <div className={TXCARD_SUB}>
                  <span className="cat-chip">{INVEST_TYPE_LABEL[row.type]}</span>
                  <span>{accountMap.get(row.accountId)?.name ?? '-'}</span>
                  <span>원금 {won(row.principal)}</span>
                  <span className={up ? 'text-accent' : 'text-danger'}>{up ? '+' : '-'}{won(row.profit)}</span>
                  <span className={`return-pill ${up ? 'up' : 'down'}`}>{up ? '+' : ''}{row.profitRate}%</span>
                  <span className={updated.stale ? 'text-amber' : ''}>{updated.label}</span>
                  {row.memo && <span>· {row.memo}</span>}
                </div>
                <div className="flex gap-2 mt-2">
                  <Button variant="ghost" className="flex-1" onClick={() => setTrade({ open: true, mode: 'buy', target: row })}>매수</Button>
                  <Button variant="ghost" className="flex-1" onClick={() => setTrade({ open: true, mode: 'sell', target: row })}>매도</Button>
                </div>
                <CardActions onEdit={() => setModal({ open: true, mode: 'edit', editing: row })} onDelete={() => handleRemove(row.id)} onCopy={() => handleDuplicate(row)} />
              </div>
            );
          })}
        </div>
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
      <AccountModal
        state={accountModal}
        onClose={() => setAccountModal((s) => ({ ...s, open: false }))}
        onSaved={() => { setAccountModal((s) => ({ ...s, open: false })); reload(); }}
      />
      {confirmElement}
    </>
  );
}

// 예수금↔평가금액 전환(매수/매도) 모달 — 금액만 입력받아 /investments/:id/buy|sell 호출. 한도는 종목이 속한 계좌의 예수금 기준
function TradeModal({ state, accountMap, onClose, onSaved }: { state: TradeState; accountMap: Map<number, InvestmentAccount>; onClose: () => void; onSaved: () => void }) {
  const t = state.target;
  const account = t ? accountMap.get(t.accountId) : undefined;
  const [amount, setAmount] = useState('');
  const [saving, setSaving] = useState(false);
  const { errors, setErrors, clearError, reset } = useFormErrors();
  const isBuy = state.mode === 'buy';
  const limit = isBuy ? account?.cashBalance ?? 0 : t?.currentValue ?? 0;

  useEffect(() => {
    if (!state.open) return;
    reset();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 모달 열릴 때 폼 초기화
    setAmount('');
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 모달 열림 시에만 폼 초기화
  }, [state.open]);

  function validate() {
    const err: Record<string, string> = {};
    const n = Number(amount);
    if (!amount || n <= 0) err.amount = '금액을 입력하세요.';
    else if (n > limit) err.amount = isBuy ? '예수금을 초과했습니다.' : '평가금액을 초과했습니다.';
    setErrors(err);
    return !Object.keys(err).length;
  }

  async function handleSave() {
    if (!t || !validate()) return;
    setSaving(true);
    try {
      await api.post(`/investments/${t.id}/${isBuy ? 'buy' : 'sell'}`, { amount: Number(amount) });
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
      <Field label={isBuy ? `금액 (원) — ${account?.name ?? ''}계좌 예수금 ${won(limit)} 이내` : `금액 (원) — 평가금액 ${won(limit)} 이내`} required error={errors.amount}>
        <input type="number" className={`input${errors.amount ? ' is-invalid' : ''}`} placeholder="0" value={amount} onChange={(ev) => { setAmount(ev.target.value); clearError('amount'); }} />
      </Field>
    </Modal>
  );
}

function InvestModal({ state, accounts, onClose, onSaved }: { state: ModalState; accounts: InvestmentAccount[]; onClose: () => void; onSaved: () => void }) {
  const e = state.editing;
  const [accountId, setAccountId] = useState<number | ''>('');
  const [name, setName] = useState('');
  const [type, setType] = useState<InvestmentType>('domestic_stock');
  const [principal, setPrincipal] = useState('');
  const [currentValue, setCurrentValue] = useState('');
  const [purchaseDate, setPurchaseDate] = useState('');
  const [memo, setMemo] = useState('');
  const [saving, setSaving] = useState(false);
  const { errors, setErrors, clearError, reset } = useFormErrors();

  useEffect(() => {
    if (!state.open) return;
    reset();
    const src = e ?? state.prefill;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 모달 열릴 때 폼 초기화
    setAccountId(src?.accountId ?? accounts[0]?.id ?? '');
    setName(src?.name ?? '');
    setType(src?.type ?? 'domestic_stock');
    setPrincipal(src ? String(src.principal) : '');
    setCurrentValue(src ? String(src.currentValue) : '');
    setPurchaseDate(e?.purchaseDate ?? (state.prefill ? toDay() : ''));
    setMemo(src?.memo ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 모달 열림/수정대상 변경 시에만 폼 초기화
  }, [state.open, e, state.prefill]);

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
      const payload = { accountId, name, type, principal: Number(principal || 0), currentValue: Number(currentValue || 0), purchaseDate: purchaseDate || undefined, memo: memo || undefined };
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
        <input type="text" className={`input${errors.name ? ' is-invalid' : ''}`} placeholder="예: 삼성전자" value={name} onChange={(ev) => { setName(ev.target.value); clearError('name'); }} />
      </Field>
      <Field label="유형" required>
        <select className="input" value={type} onChange={(ev) => setType(ev.target.value as InvestmentType)}>
          <option value="domestic_stock">국내주식</option><option value="foreign_stock">해외주식</option><option value="foreign_etf">해외ETF</option>
          <option value="domestic_etf">국내ETF</option><option value="crypto">가상자산</option><option value="etc">기타</option>
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-4 max-md:grid-cols-1">
        <Field label="투자원금 (원)" required error={errors.principal}>
          <input type="number" className={`input${errors.principal ? ' is-invalid' : ''}`} placeholder="0" value={principal} onChange={(ev) => { setPrincipal(ev.target.value); clearError('principal'); }} />
        </Field>
        <Field label="현재 평가금액 (원)" required error={errors.currentValue}>
          <input type="number" className={`input${errors.currentValue ? ' is-invalid' : ''}`} placeholder="매수 당일엔 투자원금과 동일" value={currentValue} onChange={(ev) => { setCurrentValue(ev.target.value); clearError('currentValue'); }} />
        </Field>
      </div>
      <Field label="최초 매수일"><input type="date" className="input" aria-label="최초 매수일" value={purchaseDate} onChange={(ev) => setPurchaseDate(ev.target.value)} /></Field>
      <Field label="메모 (선택)"><input type="text" className="input" placeholder="투자 전략, 목표가 등" value={memo} onChange={(ev) => setMemo(ev.target.value)} /></Field>
    </Modal>
  );
}

// 투자 계좌 추가/수정 모달 — 이름·예수금·메모만 입력
function AccountModal({ state, onClose, onSaved }: { state: AccountModalState; onClose: () => void; onSaved: () => void }) {
  const e = state.editing;
  const [name, setName] = useState('');
  const [cashBalance, setCashBalance] = useState('');
  const [memo, setMemo] = useState('');
  const [saving, setSaving] = useState(false);
  const { errors, setErrors, clearError, reset } = useFormErrors();

  useEffect(() => {
    if (!state.open) return;
    reset();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 모달 열릴 때 폼 초기화
    setName(e?.name ?? '');
    setCashBalance(e ? String(e.cashBalance) : '');
    setMemo(e?.memo ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 모달 열림/수정대상 변경 시에만 폼 초기화
  }, [state.open, e]);

  function validate() {
    const err: Record<string, string> = {};
    if (!name.trim()) err.name = '계좌명을 입력하세요.';
    setErrors(err);
    return !Object.keys(err).length;
  }

  async function handleSave() {
    if (!validate()) return;
    setSaving(true);
    try {
      const payload = { name, cashBalance: Number(cashBalance || 0), memo: memo || undefined };
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
        <input type="text" className={`input${errors.name ? ' is-invalid' : ''}`} placeholder="예: ISA, 일반위탁" value={name} onChange={(ev) => { setName(ev.target.value); clearError('name'); }} />
      </Field>
      <Field label="예수금 (원)"><input type="number" className="input" placeholder="0" value={cashBalance} onChange={(ev) => setCashBalance(ev.target.value)} /></Field>
      <Field label="메모 (선택)"><input type="text" className="input" placeholder="추가 메모" value={memo} onChange={(ev) => setMemo(ev.target.value)} /></Field>
    </Modal>
  );
}
