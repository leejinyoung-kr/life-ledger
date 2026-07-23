'use client';

import { useEffect, useMemo, useState } from 'react';
import StatCard from '@/components/StatCard';
import Modal from '@/components/Modal';
import Pagination, { LimitSelect } from '@/components/Pagination';
import Button from '@/components/ui/Button';
import { Field, ModalFooter } from '@/components/ui/Field';
import { useConfirm } from '@/components/ConfirmModal';
import { IconBank, IconWon, IconTrendUp, IconAlertTriangle, IconSearch } from '@/components/icons';
import { notify } from '@/lib/toast';
import { useFormErrors } from '@/lib/useFormErrors';
import { api } from '@/lib/api';
import { usePagination } from '@/lib/usePagination';
import { useRowSelection } from '@/lib/useRowSelection';
import { useApiQuery, useInvalidate, type Paginated } from '@/lib/query';
import { qk } from '@/lib/queryKeys';
import {
  SAVING_TYPE_LABEL, won, dotDate, daysUntil, calcMaturityAmount,
  type Category, type Saving, type SavingSummary, type SavingType,
} from '@/lib/finance';
import {
  TABLE_CARD, TXCARDS, TXCARD, TXCARD_TITLE, TXCARD_AMT, TXCARD_EMPTY,
  RowActions, CardActions, toDay, useAddTrigger,
} from '../_shared';

type ModalState = { open: boolean; mode: 'add' | 'edit'; editing?: Saving; prefill?: Saving };

export default function SavingsTab({ savingCats, bankCats, addTrigger }: { savingCats: Category[]; bankCats: Category[]; addTrigger: number }) {
  const { page, setPage, limit, changeLimit } = usePagination();
  const { confirm, confirmElement } = useConfirm();
  const [modal, setModal] = useState<ModalState>({ open: false, mode: 'add' });
  const invalidate = useInvalidate();

  const [pendingType, setPendingType] = useState('');
  const [pendingName, setPendingName] = useState('');
  const [applied, setApplied] = useState({ type: '', name: '' });

  useAddTrigger(addTrigger, () => setModal({ open: true, mode: 'add' }));

  function handleSearch() { setApplied({ type: pendingType, name: pendingName }); setPage(1); }
  function handleReset() { setPendingType(''); setPendingName(''); setApplied({ type: '', name: '' }); setPage(1); }

  // 예적금 목록 + 요약 (React Query 캐시). 목록은 서버 페이징/필터
  const listQs = useMemo(() => {
    const params = new URLSearchParams();
    if (applied.type) params.set('type', applied.type);
    if (applied.name) params.set('q', applied.name);
    params.set('page', String(page));
    params.set('limit', String(limit));
    return params.toString();
  }, [applied, page, limit]);
  const rowsQuery = useApiQuery<Paginated<Saving>>(qk.savings.list({ ...applied, page, limit }), `/savings?${listQs}`);
  const summaryQuery = useApiQuery<SavingSummary>(['savings', 'summary'], '/savings/summary');
  const rows = useMemo(() => rowsQuery.data?.items ?? [], [rowsQuery.data]);
  const total = rowsQuery.data?.total ?? 0;
  const summary = summaryQuery.data ?? null;
  const reload = () => invalidate(qk.savings.all);

  async function handleRemove(id: number) {
    if (!await confirm('이 예적금을 삭제할까요?', 'danger')) return;
    try {
      await api.del(`/savings/${id}`);
      notify.deleted('예적금');
      clear();
      reload();
    } catch {
      notify.deleteFailed();
    }
  }

  // 예적금 복사 — 해당 데이터로 채운 추가 모달을 오늘 날짜로 열어 확인 후 저장
  function handleDuplicate(row: Saving) {
    setModal({ open: true, mode: 'add', prefill: row });
  }

  async function handleRemoveSelected() {
    if (selected.size === 0) return;
    if (!await confirm(`선택한 ${selected.size}건을 삭제할까요?`, 'danger')) return;
    try {
      await api.del('/savings/bulk', { ids: [...selected] });
      notify.deleted(`${selected.size}건`);
      clear();
      reload();
    } catch {
      notify.deleteFailed();
    }
  }

  const totalPages = Math.ceil(total / limit);
  const paged = rows; // 서버가 이미 필터+페이지 단위로 잘라서 보냄
  const { selected, toggle, toggleAll, clear, allChecked } = useRowSelection(paged.map((r) => r.id));

  return (
    <>
      {summary && (
        <div className="grid grid-cols-2 min-[1100px]:grid-cols-4 gap-4 mb-6">
          <StatCard icon={<IconBank />} tone="green" value={won(summary.totalBalance)} label="총 예적금" change="전체 잔액 합계" changeDir="neutral" />
          <StatCard icon={<IconWon />} tone="blue" value={won(summary.monthlyDeposit)} label="이번 달 납입" change="월 납입액 합계" changeDir="neutral" />
          <StatCard icon={<IconTrendUp />} tone="amber" value={`${summary.avgRate}%`} label="평균 금리" change="보유 상품 평균" changeDir="up" />
          <StatCard icon={<IconAlertTriangle />} tone={summary.maturityNear > 0 ? 'red' : 'green'} value={`${summary.maturityNear}건`} label="만기 임박" change={summary.maturityNear > 0 ? '30일 이내 만기' : '이상 없음'} changeDir={summary.maturityNear > 0 ? 'down' : 'neutral'} />
        </div>
      )}

      <div className="bg-surface border border-border rounded-[var(--radius-lg)] px-5 py-4 flex flex-col gap-3 mb-4">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:flex-wrap">
          <select className="input w-full md:w-auto md:min-w-30 shrink-0" value={pendingType} onChange={(ev) => setPendingType(ev.target.value)} aria-label="유형 필터">
            <option value="">전체 유형</option>
            {savingCats.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
          </select>
          <div className="flex gap-2 flex-1">
            <div className="relative flex-1 min-w-0">
              <IconSearch className="absolute left-2.75 top-1/2 -translate-y-1/2 text-muted w-3.75 h-3.75 pointer-events-none" />
              <input className="input pl-icon w-full" type="text" placeholder="상품명 검색..." value={pendingName} onChange={(ev) => setPendingName(ev.target.value)} onKeyDown={(ev) => ev.key === 'Enter' && handleSearch()} aria-label="상품명 검색" />
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

      <div className={`${TABLE_CARD} mb-4`}>
        <div className="table-wrap max-md:hidden">
          <table>
            <colgroup>
              <col style={{ width: '40px' }} />
              <col style={{ width: '64px' }} />
              <col style={{ width: '88px' }} />
              <col style={{ width: '140px' }} />
              <col />
              <col style={{ width: '120px' }} />
              <col style={{ width: '110px' }} />
              <col style={{ width: '80px' }} />
              <col style={{ width: '130px' }} />
              <col style={{ width: '110px' }} />
              <col style={{ width: '150px' }} />
              <col style={{ width: '180px' }} />
              <col style={{ width: '72px' }} />
            </colgroup>
            <thead>
              <tr>
                <th className="td-center"><input type="checkbox" className="checkbox" checked={allChecked} onChange={toggleAll} aria-label="전체선택" /></th>
                <th>번호</th><th>유형</th><th>은행/기관</th><th>상품명</th>
                <th>잔액</th><th>월 납입</th>
                <th>금리</th><th>만기예상</th><th>가입일</th><th>만기일</th>
                <th>메모</th>
                <th>관리</th>
              </tr>
            </thead>
            <tbody>
              {paged.length === 0 && <tr><td colSpan={13} className="td-center td-muted">예적금 내역이 없습니다.</td></tr>}
              {paged.map((c, i) => {
                const dleft = daysUntil(c.maturityDate);
                const near = dleft !== null && dleft >= 0 && dleft <= 30;
                const maturityAmt = calcMaturityAmount(c);
                return (
                  <tr key={c.id}>
                    <td className="td-center"><input type="checkbox" className="checkbox" checked={selected.has(c.id)} onChange={() => toggle(c.id)} aria-label="선택" /></td>
                    <td className="td-center td-muted">{total - (page - 1) * limit - i}</td>
                    <td className="td-center"><span className={`savings-type-badge ${c.type === 'deposit' ? 'badge-deposit' : 'badge-savings'}`}>{SAVING_TYPE_LABEL[c.type]}</span></td>
                    <td className="td-center td-muted">{c.bank}</td>
                    <td className="td-name">{c.name}</td>
                    <td className="td-mono td-right">{won(c.balance)}</td>
                    <td className="td-mono td-right">{c.monthlyAmount > 0 ? won(c.monthlyAmount) : '-'}</td>
                    <td className="td-right"><span className="savings-meta-value accent">{c.interestRate}%</span></td>
                    <td className="td-mono td-right">{maturityAmt !== null ? won(maturityAmt) : '-'}</td>
                    <td className="td-center td-muted">{dotDate(c.startDate)}</td>
                    <td className={`td-center ${near ? 'savings-meta-value warning' : 'td-muted'}`}>
                      {c.maturityDate ? (
                        <span className="flex flex-col items-center leading-tight">
                          <span>{dotDate(c.maturityDate)}</span>
                          {near && <span className="text-xs mt-0.5">⚠️ D-{dleft}</span>}
                        </span>
                      ) : '-'}
                    </td>
                    <td className="td-center td-muted">{c.memo ?? '-'}</td>
                    <td className="td-center"><RowActions onEdit={() => setModal({ open: true, mode: 'edit', editing: c })} onDelete={() => handleRemove(c.id)} onCopy={() => handleDuplicate(c)} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className={TXCARDS}>
          {paged.length === 0 && <div className={TXCARD_EMPTY}>예적금 내역이 없습니다.</div>}
          {paged.map((c) => {
            const dleft = daysUntil(c.maturityDate);
            const near = dleft !== null && dleft >= 0 && dleft <= 30;
            const maturityAmt = calcMaturityAmount(c);
            return (
              <div className={TXCARD} key={c.id}>
                <div className="flex items-center gap-2 mb-1.5">
                  <input type="checkbox" className="checkbox" checked={selected.has(c.id)} onChange={() => toggle(c.id)} aria-label="선택" />
                  <div className="flex-1 flex justify-between items-center gap-2.5">
                    <span className={TXCARD_TITLE}>{c.name}</span>
                    <div className="flex flex-col items-end shrink-0">
                      <span className={TXCARD_AMT}>{won(c.balance)}</span>
                      {maturityAmt !== null && <span className="text-[0.7rem] text-secondary">만기예상 {won(maturityAmt)}</span>}
                    </div>
                  </div>
                </div>
                <div className="mt-2 pt-2 border-t border-border flex flex-col gap-1.5 text-[0.78rem]">
                  {[
                    { label: '유형', value: <span className={`savings-type-badge ${c.type === 'deposit' ? 'badge-deposit' : 'badge-savings'}`}>{SAVING_TYPE_LABEL[c.type]}</span> },
                    { label: '은행', value: c.bank },
                    { label: '금리', value: <span className="savings-meta-value accent">{c.interestRate}%</span> },
                    { label: '월납입', value: c.monthlyAmount > 0 ? won(c.monthlyAmount) : '-' },
                    { label: '가입일', value: dotDate(c.startDate) },
                    { label: '만기일', value: <span className={near ? 'savings-meta-value warning' : undefined}>{c.maturityDate ? `${dotDate(c.maturityDate)}${near ? ` ⚠️ D-${dleft}` : ''}` : '-'}</span> },
                    ...(c.memo ? [{ label: '메모', value: c.memo }] : []),
                  ].map(({ label, value }) => (
                    <div key={label} className="flex gap-2">
                      <span className="text-muted w-14 shrink-0">{label}</span>
                      <span>{value}</span>
                    </div>
                  ))}
                </div>
                <CardActions onEdit={() => setModal({ open: true, mode: 'edit', editing: c })} onDelete={() => handleRemove(c.id)} onCopy={() => handleDuplicate(c)} />
              </div>
            );
          })}
        </div>
        <Pagination page={page} totalPages={totalPages} totalItems={total} onPageChange={setPage} />
      </div>

      <SavingsModal
        state={modal}
        bankCats={bankCats}
        onClose={() => setModal((s) => ({ ...s, open: false }))}
        onSaved={() => { setModal((s) => ({ ...s, open: false })); reload(); }}
      />
      {confirmElement}
    </>
  );
}

function SavingsModal({ state, bankCats, onClose, onSaved }: { state: ModalState; bankCats: Category[]; onClose: () => void; onSaved: () => void }) {
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
  const { errors, setErrors, clearError, reset } = useFormErrors();

  useEffect(() => {
    if (!state.open) return;
    reset();
    const src = e ?? state.prefill;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 모달 열릴 때 폼 초기화
    setBank(src?.bank ?? '');
    setName(src?.name ?? '');
    setType(src?.type ?? 'savings');
    setInterestRate(src ? String(src.interestRate) : '');
    setMonthlyAmount(src ? String(src.monthlyAmount) : '');
    setStartDate(e?.startDate ?? (state.prefill ? toDay() : ''));
    setMaturityDate(src?.maturityDate ?? '');
    setBalance(src ? String(src.balance) : '');
    setMemo(src?.memo ?? '');
  }, [state.open, e, state.prefill, reset]);

  function validate() {
    const err: Record<string, string> = {};
    if (!bank.trim()) err.bank = '은행/기관을 입력하세요.';
    if (!name.trim()) err.name = '상품명을 입력하세요.';
    if (!startDate) err.startDate = '가입일을 선택하세요.';
    setErrors(err);
    return !Object.keys(err).length;
  }

  async function handleSave() {
    if (!validate()) return;
    setSaving(true);
    try {
      const payload = {
        bank, name, type,
        interestRate: interestRate ? Number(interestRate) : undefined,
        monthlyAmount: monthlyAmount ? Number(monthlyAmount) : undefined,
        startDate, maturityDate: maturityDate || undefined,
        balance: balance ? Number(balance) : undefined,
        memo: memo || undefined,
      };
      if (state.mode === 'edit' && e) await api.put(`/savings/${e.id}`, payload);
      else await api.post('/savings', payload);
      notify.upserted(state.mode, '예적금');
      onSaved();
    } catch {
      notify.saveFailed();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={state.open} onClose={onClose} title={state.mode === 'edit' ? '예적금 수정' : '예적금 추가'} footer={<ModalFooter onClose={onClose} onSave={handleSave} saving={saving} />}>
      <Field label="은행/기관" required error={errors.bank}>
        <select className={`input${errors.bank ? ' is-invalid' : ''}`} aria-label="은행/기관" value={bank} onChange={(ev) => { setBank(ev.target.value); clearError('bank'); }}>
          <option value="" disabled>은행/기관 선택</option>
          {/* 기존 자유텍스트 값이 목록에 없으면 그대로 옵션으로 노출 */}
          {bank && !bankCats.some((b) => b.label === bank) && <option value={bank}>{bank}</option>}
          {bankCats.map((b) => <option key={b.code} value={b.label}>{b.label}</option>)}
        </select>
      </Field>
      <Field label="상품명" required error={errors.name}>
        <input type="text" className={`input${errors.name ? ' is-invalid' : ''}`} placeholder="예: 26주 적금" value={name} onChange={(ev) => { setName(ev.target.value); clearError('name'); }} />
      </Field>
      <Field label="유형" required>
        <select className="input" value={type} onChange={(ev) => setType(ev.target.value as SavingType)}>
          <option value="savings">적금</option><option value="deposit">예금</option><option value="subscription">청약</option><option value="etc">기타</option>
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-4 max-md:grid-cols-1">
        <Field label="금리 (%)">
          <input type="number" className="input" placeholder="3.5" step="0.1" value={interestRate} onChange={(ev) => setInterestRate(ev.target.value)} />
        </Field>
        <Field label="월 납입액 (원)"><input type="number" className="input" placeholder="200000" value={monthlyAmount} onChange={(ev) => setMonthlyAmount(ev.target.value)} /></Field>
      </div>
      <div className="grid grid-cols-2 gap-4 max-md:grid-cols-1">
        <Field label="가입일" required error={errors.startDate}>
          <input type="date" className={`input${errors.startDate ? ' is-invalid' : ''}`} aria-label="가입일" value={startDate} onChange={(ev) => { setStartDate(ev.target.value); clearError('startDate'); }} />
        </Field>
        <Field label="만기일"><input type="date" className="input" aria-label="만기일" value={maturityDate} onChange={(ev) => setMaturityDate(ev.target.value)} /></Field>
      </div>
      <Field label="현재 잔액 (원)"><input type="number" className="input" placeholder="0" value={balance} onChange={(ev) => setBalance(ev.target.value)} /></Field>
      <Field label="메모 (선택)"><input type="text" className="input" placeholder="추가 메모" value={memo} onChange={(ev) => setMemo(ev.target.value)} /></Field>
    </Modal>
  );
}
