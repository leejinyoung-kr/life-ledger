'use client';

import { useEffect, useState } from 'react';
import Modal from '@/components/Modal';
import Button from '@/components/ui/Button';
import Segmented, { type SegmentedItem } from '@/components/ui/Segmented';
import Toggle from '@/components/ui/Toggle';
import { Field, FieldGroup, FormGroup, ModalFooter } from '@/components/ui/Field';
import { IconRefresh, IconChevronRight } from '@/components/icons';
import { PageLoading } from '@/components/QueryState';
import { notify } from '@/lib/toast';
import { api } from '@/lib/api';
import { useApiQuery } from '@/lib/query';
import { useFormErrors } from '@/lib/useFormErrors';
import {
  won, localDate, WEEKDAY_LABEL,
  type Investment, type InvestmentAccount, type InvestmentType,
  type RecurringCycle, type WeekendAdjust, type RecurringSchedule,
} from '@/lib/finance';
import { toDay } from '../_shared';
import { UnitInput } from './modalParts';

export type ModalState = { open: boolean; mode: 'add' | 'edit'; editing?: Investment; prefill?: Investment };
export type TradeState = { open: boolean; mode: 'buy' | 'sell'; target?: Investment };
export type AccountModalState = { open: boolean; mode: 'add' | 'edit'; editing?: InvestmentAccount };
export type ExchangeModalState = { open: boolean; account?: InvestmentAccount };
export type PriceState = { open: boolean; target?: Investment };
export type RecurringModalState = { open: boolean; editing?: RecurringSchedule };

// 시세조회 응답 — 단가에 저장된 보유수량을 곱한 평가금액까지 백엔드에서 산출해 내려줌
interface PriceLookupResult {
  price: number;
  currency: 'KRW' | 'USD';
  krwPrice: number;
  name: string | null;
  quantity: number;
  evaluatedValue: number;
}

// 달러 표기 ($1,234.5) — 입력값 그대로 천 단위 쉼표만 붙인다
function usdText(n: number): string {
  return `$${n.toLocaleString('en-US')}`;
}

// 창 안쪽 "이름  값" 한 줄 — 매수/매도 · 시세조회의 요약 칸에 쓴다
function SummaryRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex justify-between gap-3 text-[0.84rem]">
      <span className="text-muted">{label}</span>
      <span className={`tabular-nums ${strong ? 'font-semibold text-primary' : 'text-secondary'}`}>{value}</span>
    </div>
  );
}

// 매수/매도 — 수량 기준 입력. 단가는 종목코드가 있으면 시세조회로 자동입력(수정 가능), 없으면(가상자산 등) 직접 입력. 한도는 종목이 속한 계좌의 예수금 기준
export function TradeModal({ state, accountMap, onClose, onSaved }: { state: TradeState; accountMap: Map<number, InvestmentAccount>; onClose: () => void; onSaved: () => void }) {
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
  const money = (n: number) => (isForeign ? usdText(n) : won(n));

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
    <Modal
      open={state.open}
      onClose={onClose}
      title={`${t?.name ?? ''} ${isBuy ? '매수' : '매도'}`}
      subtitle={account ? `${account.name} · 예수금 ${money(cashLimit)}` : undefined}
      footer={<ModalFooter onClose={onClose} onSave={handleSave} saving={saving} saveLabel={isBuy ? '매수' : '매도'} />}
    >
      <div className="grid grid-cols-2 gap-3 max-md:grid-cols-1">
        <Field label={t?.symbol ? '단가 (시세조회로 자동입력, 수정 가능)' : '단가'} required error={errors.price}>
          <UnitInput unit={isForeign ? '$' : '₩'} placeholder={priceLoading ? '조회 중...' : '0'} value={price} onChange={(ev) => { setPrice(ev.target.value); clearError('price'); }} />
        </Field>
        <Field label={isBuy ? '수량' : '수량 (보유 수량 이내)'} required error={errors.quantity}>
          <input type="number" className="input text-right" placeholder="0" value={quantity} onChange={(ev) => { setQuantity(ev.target.value); clearError('quantity'); }} />
          {!isBuy && <span className="text-[0.75rem] text-muted">보유 {(t?.quantity ?? 0).toLocaleString('ko-KR')}개</span>}
        </Field>
      </div>
      <div className="flex flex-col gap-1.5 pt-4 border-t border-border-subtle">
        <SummaryRow label={isBuy ? '필요 금액' : '환입 금액'} value={amount > 0 ? money(amount) : '-'} strong />
        {isBuy && <SummaryRow label="계좌 예수금" value={money(cashLimit)} />}
      </div>
    </Modal>
  );
}

// 시세조회 — 등록된 종목코드/티커로 단가 조회 + 저장된 보유수량을 곱한 평가금액을 백엔드가 바로 산출. 확인 후 반영 버튼 한 번으로 끝남(수량 재입력 없음)
export function PriceLookupModal({ state, onClose, onSaved }: { state: PriceState; onClose: () => void; onSaved: () => void }) {
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
    <Modal open={state.open} onClose={onClose} size="sm" title={`${t?.name ?? ''} 시세조회`} footer={<ModalFooter onClose={onClose} onSave={handleApply} saving={saving} saveLabel="평가금액에 반영" saveDisabled={!result} />}>
      {loading && <PageLoading size="sm" message="조회 중..." />}
      {result && (
        <div className="flex flex-col gap-1.5">
          <SummaryRow label={result.name ?? t?.symbol ?? '현재가'} value={result.currency === 'KRW' ? won(result.price) : `${usdText(result.price)} (${won(result.krwPrice)})`} />
          <SummaryRow label="보유수량" value={`${result.quantity.toLocaleString('ko-KR')}개`} />
          <div className="pt-3 mt-1 border-t border-border-subtle">
            <SummaryRow label="반영될 평가금액" value={won(result.evaluatedValue)} strong />
          </div>
        </div>
      )}
    </Modal>
  );
}

// 투자 항목 추가/수정 — 종목 · 금액 · 날짜 세 묶음. 해외 종목이면 원금 · 평가금액 · 도우미가 모두 달러($)
export function InvestModal({ state, accounts, onClose, onSaved }: { state: ModalState; accounts: InvestmentAccount[]; onClose: () => void; onSaved: () => void }) {
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
  const [helperResult, setHelperResult] = useState<number | null>(null);
  const [purchaseDate, setPurchaseDate] = useState('');
  const [memo, setMemo] = useState('');
  const [saving, setSaving] = useState(false);
  const { errors, setErrors, setError, clearError, reset } = useFormErrors();
  const isForeign = type === 'foreign_stock' || type === 'foreign_etf';
  const unit = isForeign ? '$' : '₩';
  const selectedAccount = accounts.find((a) => a.id === accountId);

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
    setHelperResult(null);
    setPurchaseDate(e?.purchaseDate ?? (state.prefill ? toDay() : ''));
    setMemo(src?.memo ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 모달 열림/수정대상 변경 시에만 폼 초기화
  }, [state.open, e, state.prefill]);

  // 현재 평가금액 + 수익(금액 또는 %)으로 투자원금을 역산해 미리 보여 준다 — "넣기"를 눌러야 원금 칸에 들어간다
  function calcProfitHelper() {
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
    // 달러는 센트까지, 원화는 원 단위로 맞춘다
    setHelperResult(isForeign ? Math.round(computed * 100) / 100 : Math.round(computed));
    clearError('profitHelper');
  }

  // 미리 본 역산 결과를 투자원금 칸에 넣는다
  function applyHelperResult() {
    if (helperResult === null) return;
    setPrincipal(String(helperResult));
    clearError('principal');
    setHelperResult(null);
  }

  function validate() {
    const err: Record<string, string> = {};
    if (!accountId) err.accountId = '계좌를 선택하세요.';
    if (!name.trim()) err.name = '종목명을 입력하세요.';
    if (!principal || Number(principal) <= 0) err.principal = '투자원금을 입력하거나 아래 도우미로 계산하세요.';
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

  const helperUnit = profitHelperMode === 'amount' ? unit : '%';

  return (
    <Modal
      open={state.open}
      onClose={onClose}
      size="lg"
      title={state.mode === 'edit' ? '투자 항목 수정' : '투자 항목 추가'}
      subtitle={selectedAccount ? `${selectedAccount.name} · 원화 예수금 ${won(selectedAccount.cashBalance)}` : undefined}
      footer={<ModalFooter onClose={onClose} onSave={handleSave} saving={saving} />}
    >
      <FormGroup no={1} title="종목" first>
        <div className="grid grid-cols-2 gap-3 max-md:grid-cols-1">
          <Field label="계좌" required error={errors.accountId}>
            <select className="input" value={accountId} onChange={(ev) => { setAccountId(ev.target.value ? Number(ev.target.value) : ''); clearError('accountId'); }}>
              <option value="" disabled>계좌 선택</option>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </Field>
          <Field label="종목명" required error={errors.name}>
            <input type="text" className="input" placeholder="예: 삼성전자" value={name} onChange={(ev) => { setName(ev.target.value); clearError('name'); }} />
          </Field>
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-[0.78rem] text-muted">유형<span className="text-danger"> *</span></span>
          <Segmented
            label="유형"
            variant="joined"
            fill
            value={type}
            onChange={setType}
            items={[
              { value: 'domestic_stock', label: '국내주식' }, { value: 'foreign_stock', label: '해외주식' }, { value: 'foreign_etf', label: '해외ETF' },
              { value: 'domestic_etf', label: '국내ETF' }, { value: 'crypto', label: '가상자산' }, { value: 'etc', label: '기타' },
            ]}
          />
        </div>
        <div className="grid grid-cols-2 gap-3 max-md:grid-cols-1">
          <Field label="종목코드 / 티커 (선택)" error={errors.symbol}>
            <input type="text" className="input uppercase" placeholder="국내: 005930, 해외: AAPL" value={symbol} onChange={(ev) => { setSymbol(ev.target.value); clearError('symbol'); }} />
          </Field>
          <Field label="보유수량 (선택)">
            <input type="number" className="input text-right" placeholder="시세조회에 사용" value={quantity} onChange={(ev) => setQuantity(ev.target.value)} />
          </Field>
        </div>
      </FormGroup>

      <FormGroup no={2} title="금액">
        <div className="grid grid-cols-2 gap-3 max-md:grid-cols-1">
          <Field label="투자원금" required error={errors.principal}>
            <UnitInput unit={unit} placeholder="0" value={principal} onChange={(ev) => { setPrincipal(ev.target.value); clearError('principal'); }} />
          </Field>
          <Field label="현재 평가금액" required error={errors.currentValue}>
            <UnitInput unit={unit} placeholder="매수 당일엔 투자원금과 동일" value={currentValue} onChange={(ev) => { setCurrentValue(ev.target.value); clearError('currentValue'); setHelperResult(null); }} />
            {isForeign && <span className="text-[0.75rem] text-muted">해외 종목은 달러($)로 입력합니다.</span>}
          </Field>
        </div>
        <details className="group bg-surface rounded-ui">
          <summary className="flex items-center gap-2 min-h-10 px-3 text-[0.84rem] cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden">
            <IconRefresh className="w-3.75 h-3.75 text-accent shrink-0" />
            <span className="flex-1">투자원금을 모를 때 — 평가금액과 수익(금액) 또는 수익률(%)을 넣으면 원금 계산</span>
            <IconChevronRight className="w-3.75 h-3.75 text-muted shrink-0 transition-transform group-open:rotate-90" />
          </summary>
          <div className="flex flex-col gap-3 px-3 pb-3 pt-1">
            <Segmented
              label="수익 입력 방식"
              variant="joined"
              fill
              value={profitHelperMode}
              onChange={(m) => { setProfitHelperMode(m); setHelperResult(null); }}
              items={[{ value: 'amount', label: `수익(${isForeign ? '$' : '원'})` }, { value: 'rate', label: '수익률(%)' }]}
            />
            <Field label={profitHelperMode === 'amount' ? '수익 (손실은 음수)' : '수익률 (손실은 음수)'} error={errors.profitHelper}>
              <UnitInput
                unit={helperUnit} side={profitHelperMode === 'rate' ? 'right' : 'left'}
                placeholder={profitHelperMode === 'amount' ? (isForeign ? '예: 12.5' : '예: 19000') : '예: 5.1'}
                value={profitHelperValue} onChange={(ev) => { setProfitHelperValue(ev.target.value); clearError('profitHelper'); setHelperResult(null); }}
              />
            </Field>
            <Button type="button" variant="ghost" onClick={calcProfitHelper}>투자원금 계산</Button>
            {helperResult !== null && (
              <div className="flex items-center justify-between gap-3 text-[0.84rem]">
                <span>계산된 투자원금 <b className="font-semibold tabular-nums">{isForeign ? usdText(helperResult) : won(helperResult)}</b></span>
                <Button type="button" size="sm" onClick={applyHelperResult}>넣기</Button>
              </div>
            )}
          </div>
        </details>
      </FormGroup>

      <FormGroup no={3} title="날짜 · 메모">
        <div className="grid grid-cols-2 gap-3 max-md:grid-cols-1">
          <Field label="최초 매수일" error={errors.purchaseDate}>
            <input type="date" className="input" aria-label="최초 매수일" value={purchaseDate} onChange={(ev) => setPurchaseDate(ev.target.value)} />
          </Field>
          <Field label="메모 (선택)">
            <input type="text" className="input" placeholder="투자 전략, 목표가 등" value={memo} onChange={(ev) => setMemo(ev.target.value)} />
          </Field>
        </div>
      </FormGroup>
    </Modal>
  );
}

// 투자 계좌 추가/수정 모달 — 이름·예수금·계좌번호·메모 입력. 계좌번호는 서버에 암호화 저장되며 목록엔 마스킹되어 표시되므로, 수정 시엔 비워두면 기존 값 유지
export function AccountModal({ state, onClose, onSaved }: { state: AccountModalState; onClose: () => void; onSaved: () => void }) {
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
      <Field label={isEdit ? '계좌번호 (변경 시에만 입력)' : '계좌번호'} required={!isEdit} error={errors.accountNumber}>
        <input type="text" className="input" placeholder={isEdit ? '비워두면 기존 번호 유지' : '동일 계좌명 다중 보유 시 구분용'} value={accountNumber} onChange={(ev) => { setAccountNumber(ev.target.value); clearError('accountNumber'); }} />
      </Field>
      <div className="grid grid-cols-2 gap-3 max-md:grid-cols-1">
        <Field label="원화 예수금"><UnitInput unit="₩" placeholder="0" value={cashBalance} onChange={(ev) => setCashBalance(ev.target.value)} /></Field>
        <Field label="달러 예수금"><UnitInput unit="$" placeholder="0" value={cashBalanceUsd} onChange={(ev) => setCashBalanceUsd(ev.target.value)} /></Field>
        <Field label="가입일 (선택, ISA 등)"><input type="date" className="input" aria-label="가입일" value={startDate} onChange={(ev) => setStartDate(ev.target.value)} /></Field>
        <Field label="만기일 (선택)"><input type="date" className="input" aria-label="만기일" value={maturityDate} onChange={(ev) => setMaturityDate(ev.target.value)} /></Field>
      </div>
      {!isEdit && <div className="text-[0.78rem] text-muted -mt-1">만기일을 비워두면 ISA 기본 가입 기간(가입일 + 3년)으로 자동 계산됩니다.</div>}
      <Field label="메모 (선택)"><input type="text" className="input" placeholder="추가 메모" value={memo} onChange={(ev) => setMemo(ev.target.value)} /></Field>
    </Modal>
  );
}

// 환전 모달 — 계좌 내 원화↔달러 예수금 상호 전환. 환율 미입력 시 서버가 실시간 조회(frankfurter.app)
export function ExchangeModal({ state, onClose, onSaved }: { state: ExchangeModalState; onClose: () => void; onSaved: () => void }) {
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
    <Modal
      open={state.open}
      onClose={onClose}
      size="sm"
      title="환전"
      subtitle={a ? `${a.name} · ${won(a.cashBalance)} · ${usdText(a.cashBalanceUsd)}` : undefined}
      footer={<ModalFooter onClose={onClose} onSave={handleSave} saving={saving} saveLabel="환전" />}
    >
      <Segmented
        label="환전 방향"
        variant="joined"
        fill
        value={direction}
        onChange={(d) => { setDirection(d); clearError('amount'); }}
        items={[{ value: 'krw_to_usd', label: '원화 → 달러' }, { value: 'usd_to_krw', label: '달러 → 원화' }]}
      />
      <Field label={`${fromLabel} 환전 금액 (보유 ${direction === 'krw_to_usd' ? won(available) : usdText(available)})`} required error={errors.amount}>
        <UnitInput
          unit={direction === 'krw_to_usd' ? '₩' : '$'}
          placeholder={direction === 'krw_to_usd' ? '예: 1000000' : '예: 100'}
          value={amount} onChange={(ev) => { setAmount(ev.target.value); clearError('amount'); }}
        />
      </Field>
      <Field label="환율 (1달러당 원화, 선택 — 비우면 자동)">
        <UnitInput unit="₩" placeholder="자동" value={rate} onChange={(ev) => setRate(ev.target.value)} />
      </Field>
      <p className="text-[0.78rem] text-muted">{fromLabel} 예수금에서 차감되어 {toLabel} 예수금으로 환산되어 더해집니다.</p>
    </Modal>
  );
}

// 반복매수 자동이체 설정 모달 — "데이터는 그냥 생성만" 원칙에 따라 종목 등록 모달과 완전히 분리.
// 이미 등록된 종목 중 하나를 골라 반복 규칙만 설정 — 저장 시 매수는 하지 않고 RecurringSchedule만 생성/수정한다.
export function RecurringInvestmentModal({ state, onClose, onSaved }: { state: RecurringModalState; onClose: () => void; onSaved: () => void }) {
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

  const showWeekend = recurringCycle !== 'weekly' && recurringCycle !== 'daily';

  return (
    <Modal
      open={state.open}
      onClose={onClose}
      title={r ? '반복매수 설정 수정' : '반복매수 설정 추가'}
      subtitle="정한 날마다 매수 기록을 만듭니다"
      footer={<ModalFooter onClose={onClose} onSave={handleSave} saving={saving} />}
    >
      <Field label="대상 종목" required error={errors.investmentId}>
        <select className="input" value={investmentId} onChange={(ev) => { setInvestmentId(ev.target.value ? Number(ev.target.value) : ''); clearError('investmentId'); }}>
          <option value="" disabled>종목 선택</option>
          {investments.map((v) => (
            <option key={v.id} value={v.id} disabled={!v.symbol}>{v.name}{v.symbol ? ` (${v.symbol})` : ' — 종목코드 없음'}</option>
          ))}
        </select>
      </Field>
      <div className="text-[0.78rem] text-muted -mt-1">종목코드/티커 기준으로 회차를 계산해, 그 시점 실시간 시세로 자동 매수합니다.</div>
      <div className="grid grid-cols-2 gap-3 max-md:grid-cols-1">
        <Field label="시작일" required error={errors.startDate}>
          <input type="date" className="input" value={startDate} onChange={(ev) => { setStartDate(ev.target.value); clearError('startDate'); }} />
        </Field>
        <FieldGroup label="반복 주기" required>
          <Segmented label="반복 주기" variant="joined" fill value={recurringCycle} onChange={setRecurringCycle} items={CYCLE_ITEMS} />
        </FieldGroup>
        {recurringCycle === 'yearly' && (
          <Field label="월" required>
            <select className="input" value={recurringMonth} onChange={(ev) => setRecurringMonth(Number(ev.target.value))}>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => <option key={m} value={m}>{m}월</option>)}
            </select>
          </Field>
        )}
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
        {showWeekend && (
          <Field label="주말인 경우">
            <select className="input" value={weekendAdjust} onChange={(ev) => setWeekendAdjust(ev.target.value as WeekendAdjust)}>
              <option value="none">조정 안 함</option>
              <option value="before">전 금요일</option>
              <option value="after">다음 월요일</option>
            </select>
          </Field>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3 items-start pt-4 border-t border-border-subtle max-md:grid-cols-1">
        <div className="flex flex-col gap-1.5">
          <span className="text-[0.78rem] text-muted">회차당 매수 기준<span className="text-danger"> *</span></span>
          <Segmented
            label="회차당 매수 기준"
            variant="joined"
            fill
            value={recurringMode}
            onChange={setRecurringMode}
            items={[{ value: 'amount', label: '금액' }, { value: 'quantity', label: '수량(n주)' }]}
          />
        </div>
        {recurringMode === 'amount' ? (
          <Field label="회차당 매수금액" required error={errors.recurringAmount}>
            <UnitInput unit={isForeign ? '$' : '₩'} placeholder="0" value={recurringAmount} onChange={(ev) => { setRecurringAmount(ev.target.value); clearError('recurringAmount'); }} />
          </Field>
        ) : (
          <Field label="회차당 매수수량" required error={errors.recurringQuantity}>
            <UnitInput unit="주" side="right" placeholder="0" value={recurringQuantity} onChange={(ev) => { setRecurringQuantity(ev.target.value); clearError('recurringQuantity'); }} />
          </Field>
        )}
      </div>
      <div className="flex items-center gap-3 pt-4 border-t border-border-subtle">
        <div className="flex-1 flex flex-col">
          <span className="text-[0.875rem] text-primary">활성</span>
          <span className="text-[0.78rem] text-muted">끄면 새 회차를 매수하지 않습니다</span>
        </div>
        <Toggle on={active} onToggle={() => setActive(!active)} label="활성" />
      </div>
    </Modal>
  );
}

const CYCLE_ITEMS: SegmentedItem<RecurringCycle>[] = [
  { value: 'daily', label: '매일' }, { value: 'weekly', label: '매주' }, { value: 'monthly', label: '매월' }, { value: 'yearly', label: '매년' },
];
