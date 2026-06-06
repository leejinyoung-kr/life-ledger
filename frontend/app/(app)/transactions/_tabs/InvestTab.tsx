'use client';

import { useEffect, useRef, useState } from 'react';
import StatCard from '@/components/StatCard';
import Modal from '@/components/Modal';
import Pagination, { LimitSelect } from '@/components/Pagination';
import Button from '@/components/ui/Button';
import { Field, ModalFooter } from '@/components/ui/Field';
import { useConfirm } from '@/components/ConfirmModal';
import { IconTrendUp, IconWon, IconChart, IconSearch } from '@/components/icons';
import { notify } from '@/lib/toast';
import { api } from '@/lib/api';
import {
  INVEST_TYPE_LABEL, won,
  type Category, type Investment, type InvestmentSummary, type InvestmentType,
} from '@/lib/finance';
import {
  TABLE_CARD, TXCARDS, TXCARD, TXCARD_TOP, TXCARD_TITLE, TXCARD_AMT, TXCARD_SUB, TXCARD_EMPTY,
  RowActions, CardActions,
} from '../_shared';

type ModalState = { open: boolean; mode: 'add' | 'edit'; editing?: Investment };

export default function InvestTab({ investCats, addTrigger }: { investCats: Category[]; addTrigger: number }) {
  const [rows, setRows] = useState<Investment[]>([]);
  const [summary, setSummary] = useState<InvestmentSummary | null>(null);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [reloadKey, setReloadKey] = useState(0);
  const { confirm, confirmElement } = useConfirm();
  const [modal, setModal] = useState<ModalState>({ open: false, mode: 'add' });

  const [pendingName, setPendingName] = useState('');
  const [pendingType, setPendingType] = useState('');
  const [applied, setApplied] = useState({ name: '', type: '' });

  const mountTrigger = useRef(addTrigger);
  useEffect(() => {
    if (addTrigger !== mountTrigger.current) {
      mountTrigger.current = addTrigger;
      setModal({ open: true, mode: 'add' });
    }
  }, [addTrigger]);

  function search() { setApplied({ name: pendingName, type: pendingType }); setPage(1); }
  function reset() { setPendingName(''); setPendingType(''); setApplied({ name: '', type: '' }); setPage(1); }

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
      notify.deleted('투자 항목');
      setReloadKey((k) => k + 1);
    } catch {
      notify.deleteFailed();
    }
  }

  const profitUp = (summary?.totalProfit ?? 0) >= 0;
  const filtered = rows
    .filter((r) => !applied.type || r.type === applied.type)
    .filter((r) => !applied.name || r.name.includes(applied.name));
  const totalPages = Math.ceil(filtered.length / limit);
  const paged = filtered.slice((page - 1) * limit, page * limit);

  return (
    <>
      {summary && (
        <div className="grid grid-cols-1 min-[1100px]:grid-cols-3 gap-4 mb-6">
          <StatCard icon={<IconTrendUp />} tone="blue" value={won(summary.totalValue)} label="총 평가금액" change={`원금 대비 ${profitUp ? '+' : ''}${summary.profitRate}%`} changeDir={profitUp ? 'up' : 'down'} />
          <StatCard icon={<IconWon />} tone="amber" value={won(summary.totalPrincipal)} label="총 투자원금" change="투자 원금 합계" changeDir="neutral" />
          <StatCard icon={<IconChart />} tone={profitUp ? 'green' : 'red'} value={`${profitUp ? '+' : '-'}${won(summary.totalProfit)}`} label="총 수익" change={`수익률 ${profitUp ? '+' : ''}${summary.profitRate}%`} changeDir={profitUp ? 'up' : 'down'} />
        </div>
      )}

      <div className="bg-surface border border-border rounded-[var(--radius-lg)] px-5 py-4 flex flex-col gap-3 mb-4">
        <div className="flex gap-2 items-center max-md:flex-wrap">
          <select className="input w-auto min-w-[120px] shrink-0" value={pendingType} onChange={(ev) => setPendingType(ev.target.value)} aria-label="유형 필터">
            <option value="">전체 유형</option>
            {investCats.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
          </select>
          <div className="relative flex-1 min-w-[160px]">
            <IconSearch className="absolute left-[11px] top-1/2 -translate-y-1/2 text-muted w-[15px] h-[15px] pointer-events-none" />
            <input className="input pl-icon" type="text" placeholder="종목명 검색..." value={pendingName} onChange={(ev) => setPendingName(ev.target.value)} onKeyDown={(ev) => ev.key === 'Enter' && search()} aria-label="종목명 검색" />
          </div>
          <Button onClick={search}>조회</Button>
          <Button variant="ghost" onClick={reset}>초기화</Button>
        </div>
      </div>

      <div className="flex items-center justify-between mb-2">
        <span className="text-[0.78rem] text-secondary">총 {filtered.length}건</span>
        <LimitSelect limit={limit} onLimitChange={(n) => { setLimit(n); setPage(1); }} />
      </div>

      <div className={`${TABLE_CARD} mb-6`}>
        <div className="table-wrap max-md:hidden">
          <table>
            <colgroup>
              <col style={{ width: '64px' }} />
              <col style={{ width: '130px' }} />
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
              {paged.length === 0 && <tr><td colSpan={9} className="td-center td-muted">투자 항목이 없습니다.</td></tr>}
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
                    <td className="td-center"><RowActions onEdit={() => setModal({ open: true, mode: 'edit', editing: row })} onDelete={() => remove(row.id)} /></td>
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
            return (
              <div className={TXCARD} key={row.id}>
                <div className={TXCARD_TOP}>
                  <span className={TXCARD_TITLE}>{row.name}</span>
                  <span className={TXCARD_AMT}>{won(row.currentValue)}</span>
                </div>
                <div className={TXCARD_SUB}>
                  <span className="cat-chip">{INVEST_TYPE_LABEL[row.type]}</span>
                  <span>원금 {won(row.principal)}</span>
                  <span className={up ? 'text-accent' : 'text-danger'}>{up ? '+' : '-'}{won(row.profit)}</span>
                  <span className={`return-pill ${up ? 'up' : 'down'}`}>{up ? '+' : ''}{row.profitRate}%</span>
                  {row.memo && <span>· {row.memo}</span>}
                </div>
                <CardActions onEdit={() => setModal({ open: true, mode: 'edit', editing: row })} onDelete={() => remove(row.id)} />
              </div>
            );
          })}
        </div>
        <Pagination page={page} totalPages={totalPages} totalItems={filtered.length} onPageChange={setPage} />
      </div>

      <InvestModal
        state={modal}
        onClose={() => setModal((s) => ({ ...s, open: false }))}
        onSaved={() => { setModal((s) => ({ ...s, open: false })); setReloadKey((k) => k + 1); }}
      />
      {confirmElement}
    </>
  );
}

function InvestModal({ state, onClose, onSaved }: { state: ModalState; onClose: () => void; onSaved: () => void }) {
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
      notify.upserted(state.mode, '투자 항목');
      onSaved();
    } catch {
      notify.saveFailed();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={state.open} onClose={onClose} title={state.mode === 'edit' ? '투자 항목 수정' : '투자 항목 추가'} footer={<ModalFooter onClose={onClose} onSave={save} saving={saving} />}>
      <Field label="종목명" required error={errors.name}>
        <input type="text" className={`input${errors.name ? ' is-invalid' : ''}`} placeholder="예: 삼성전자" value={name} onChange={(ev) => { setName(ev.target.value); clearErr('name'); }} />
      </Field>
      <Field label="유형" required>
        <select className="input" value={type} onChange={(ev) => setType(ev.target.value as InvestmentType)}>
          <option value="domestic_stock">국내주식</option><option value="foreign_stock">해외주식</option><option value="foreign_etf">해외ETF</option>
          <option value="domestic_etf">국내ETF</option><option value="crypto">가상자산</option><option value="etc">기타</option>
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-4 max-md:grid-cols-1">
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
