'use client';

import { useEffect, useMemo, useState } from 'react';
import StatCard, { StatStrip } from '@/components/StatCard';
import Modal from '@/components/Modal';
import Pagination, { LimitSelect } from '@/components/Pagination';
import ListToolbar from '@/components/ListToolbar';
import Button from '@/components/ui/Button';
import IconButton from '@/components/ui/IconButton';
import Badge from '@/components/ui/Badge';
import Segmented from '@/components/ui/Segmented';
import SearchInput from '@/components/ui/SearchInput';
import { Field, ModalFooter } from '@/components/ui/Field';
import { useConfirm } from '@/components/ConfirmModal';
import { IconBank, IconWon, IconTrendUp, IconAlertTriangle, IconEdit, IconCopy, IconTrash } from '@/components/icons';
import { notify } from '@/lib/toast';
import { useFormErrors } from '@/lib/useFormErrors';
import { api } from '@/lib/api';
import { usePagination } from '@/lib/usePagination';
import { useRowSelection } from '@/lib/useRowSelection';
import { useApiQuery, useInvalidate, type Paginated } from '@/lib/query';
import { qk } from '@/lib/queryKeys';
import MobileCard, { MobileCardList } from '@/components/MobileCard';
import TableEmptyRow from '@/components/TableEmptyRow';
import FilterPanel from '@/components/FilterPanel';
import {
  SAVING_TYPE_LABEL, enumOptions, enumLabel, activeWith, won, dotDate, daysUntil, calcMaturityAmount,
  type Category, type Saving, type SavingSummary, type SavingType,
} from '@/lib/finance';
import { toDay, useAddTrigger } from '../_shared';
import { UnitInput } from './modalParts';

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
  // 은행 code → 이름 (비활성 포함 전체). 예적금에는 code 가 저장된다 (ADR 0009)
  const bankLabel = useMemo(() => Object.fromEntries(bankCats.map((b) => [b.code, b.label])), [bankCats]);

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
    const row = rows.find((r) => r.id === id);
    const dleft = daysUntil(row?.maturityDate ?? null);
    const matured = dleft !== null && dleft < 0;
    const message = matured
      ? '만기가 지난 예적금을 삭제할까요? 목록에서 사라지며 잔액은 자동으로 옮겨지지 않습니다. 필요하면 먼저 가계부에 입금 내역을 기록하세요.'
      : '이 예적금을 삭제할까요?';
    if (!await confirm(message, 'danger')) return;
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

  const openEdit = (c: Saving) => setModal({ open: true, mode: 'edit', editing: c });

  return (
    <>
      {summary && (
        <StatStrip>
          <StatCard icon={<IconBank />} tone="green" value={won(summary.totalBalance)} label="총 예적금" change="전체 잔액 합계" changeDir="neutral" />
          <StatCard icon={<IconWon />} tone="blue" value={won(summary.monthlyDeposit)} valueTone="move" label="이번 달 납입" change="⇄ 월 납입액 합계" changeDir="neutral" />
          <StatCard icon={<IconTrendUp />} tone="amber" value={`${summary.avgRate}%`} label="평균 금리" change="보유 상품 평균" changeDir="neutral" />
          <StatCard icon={<IconAlertTriangle />} tone={summary.maturityNear > 0 ? 'red' : 'green'} value={`${summary.maturityNear}건`} valueTone={summary.maturityNear > 0 ? 'warn' : undefined} label="만기 임박" change={summary.maturityNear > 0 ? '30일 이내 만기' : '이상 없음'} changeDir={summary.maturityNear > 0 ? 'down' : 'neutral'} />
        </StatStrip>
      )}

      <FilterPanel className="mb-0 border-b-0">
        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          {/* 유형 · 검색 · 조회 한 줄 (휴대폰도) */}
          <div className="flex gap-2 items-center flex-1 min-w-0">
            <select className="input w-24 shrink-0 md:w-auto md:min-w-30" value={pendingType} onChange={(ev) => setPendingType(ev.target.value)} aria-label="유형 필터">
              <option value="">전체</option>
              {enumOptions(SAVING_TYPE_LABEL, savingCats).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <SearchInput label="상품명 검색" className="flex-1 min-w-0" placeholder="상품명 검색" value={pendingName} onChange={(ev) => setPendingName(ev.target.value)} onEnter={handleSearch} />
            <Button className="shrink-0" onClick={handleSearch}>조회</Button>
          </div>
          <Button variant="ghost" className="w-full md:w-auto" onClick={handleReset}>초기화</Button>
        </div>
      </FilterPanel>

      <ListToolbar total={total} summary={<span className="text-muted max-md:hidden">가입일 · 메모는 행을 누르면 수정 창에서</span>}>
        <Button variant="danger" size="sm" disabled={selected.size === 0} onClick={handleRemoveSelected}>선택삭제</Button>
        <LimitSelect limit={limit} onLimitChange={changeLimit} />
      </ListToolbar>

      <div className="mb-6">
        <div className="table-wrap max-md:hidden mt-3">
          {/* 1280 미만(사이드바 옆 본문 730px 안팎)에서는 월 납입 · 금리 칸을 숨기고 상품 아래 줄로 옮긴다 — 상품 이름이 세로로 쪼개지지 않게 */}
          <table>
            <thead>
              <tr>
                <th className="th-left w-10"><input type="checkbox" className="checkbox" checked={allChecked} onChange={toggleAll} aria-label="전체선택" /></th>
                <th className="th-left min-w-36">상품</th>
                <th className="td-right">잔액</th>
                <th className="td-right max-xl:hidden">월 납입</th>
                <th className="td-right max-xl:hidden">금리</th>
                <th className="th-left"><span className="pl-6">만기일</span></th>
                <th className="td-right">만기 예상액</th>
                <th className="td-right"><span className="sr-only">관리</span></th>
              </tr>
            </thead>
            <tbody>
              {paged.length === 0 && <TableEmptyRow colSpan={8} message="예적금 내역이 없습니다." />}
              {paged.map((c) => {
                const dleft = daysUntil(c.maturityDate);
                const near = dleft !== null && dleft >= 0 && dleft <= 30;
                const matured = dleft !== null && dleft < 0;
                const maturityAmt = calcMaturityAmount(c);
                const warn = near || matured;
                return (
                  <tr key={c.id} className="cursor-pointer" onClick={() => openEdit(c)}>
                    <td onClick={(ev) => ev.stopPropagation()}><input type="checkbox" className="checkbox" checked={selected.has(c.id)} onChange={() => toggle(c.id)} aria-label="선택" /></td>
                    <td>
                      <div className="flex flex-col leading-snug min-w-0">
                        <span>{c.name}</span>
                        <span className="text-[0.75rem] text-muted">
                          {bankLabel[c.bank] ?? c.bank} · {enumLabel(SAVING_TYPE_LABEL, savingCats, c.type)}
                          <span className="xl:hidden"> · {c.interestRate}%{c.monthlyAmount > 0 ? ` · 월 ${won(c.monthlyAmount)}` : ''}</span>
                        </span>
                      </div>
                    </td>
                    <td className="td-mono td-right">{won(c.balance)}</td>
                    <td className="td-mono td-right text-muted max-xl:hidden">{c.monthlyAmount > 0 ? won(c.monthlyAmount) : '-'}</td>
                    <td className="td-mono td-right max-xl:hidden">{c.interestRate}%</td>
                    {/* 만기일과 예상액을 한 칸에 쌓지 않고 나눈다 — 임박 · 만기됨은 날짜 옆 배지로 */}
                    <td className="td-mono">
                      {c.maturityDate ? (
                        <span className="flex items-center gap-2 pl-6">
                          <span className={warn ? 'text-warning' : 'text-secondary'}>{dotDate(c.maturityDate)}</span>
                          {near && <Badge size="sm" tone="warning">D-{dleft}</Badge>}
                          {matured && <Badge size="sm" tone="neutral">만기됨</Badge>}
                        </span>
                      ) : <span className="pl-6 text-muted">-</span>}
                    </td>
                    <td className={`td-mono td-right ${warn ? 'text-warning' : ''}`}>{maturityAmt !== null ? won(maturityAmt) : <span className="text-muted">-</span>}</td>
                    <td onClick={(ev) => ev.stopPropagation()}>
                      <div className="flex justify-end pl-4">
                        <IconButton label="복사" onClick={() => handleDuplicate(c)}><IconCopy /></IconButton>
                        <IconButton label="수정" onClick={() => openEdit(c)}><IconEdit /></IconButton>
                        <IconButton label="삭제" variant="danger" onClick={() => handleRemove(c.id)}><IconTrash /></IconButton>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <MobileCardList empty={paged.length === 0 && '예적금 내역이 없습니다.'} selection={{ all: allChecked, count: selected.size, onToggleAll: toggleAll }}>
          {paged.map((c) => {
            const dleft = daysUntil(c.maturityDate);
            const near = dleft !== null && dleft >= 0 && dleft <= 30;
            const matured = dleft !== null && dleft < 0;
            const maturityAmt = calcMaturityAmount(c);
            return (
              <MobileCard
                key={c.id}
                checked={selected.has(c.id)}
                onCheck={() => toggle(c.id)}
                title={c.name}
                sub={`${bankLabel[c.bank] ?? c.bank} · ${enumLabel(SAVING_TYPE_LABEL, savingCats, c.type)}`}
                aside={<>
                  <span className="text-[0.95rem] font-semibold tabular-nums">{won(c.balance)}</span>
                  {maturityAmt !== null && <span className="text-[0.72rem] text-muted tabular-nums">만기예상 {won(maturityAmt)}</span>}
                </>}
                fields={[
                  { label: '금리', value: <span className="text-accent-dark font-medium">{c.interestRate}%</span> },
                  { label: '월 납입', value: c.monthlyAmount > 0 ? won(c.monthlyAmount) : null },
                  { label: '가입일', value: dotDate(c.startDate) },
                  {
                    label: '만기일',
                    value: c.maturityDate ? `${dotDate(c.maturityDate)}${near ? ` · D-${dleft}` : matured ? ' · 만기됨' : ''}` : null,
                    tone: near || matured ? 'warning' : undefined,
                  },
                  { label: '메모', value: c.memo },
                ]}
                actions={[
                  { label: '복사', onClick: () => handleDuplicate(c) },
                  { label: '수정', onClick: () => openEdit(c) },
                  { label: '삭제', danger: true, onClick: () => handleRemove(c.id) },
                ]}
              />
            );
          })}
        </MobileCardList>
        <Pagination page={page} totalPages={totalPages} totalItems={total} onPageChange={setPage} />
      </div>

      <SavingsModal
        state={modal}
        savingCats={savingCats}
        bankCats={bankCats}
        onClose={() => setModal((s) => ({ ...s, open: false }))}
        onSaved={() => { setModal((s) => ({ ...s, open: false })); reload(); }}
      />
      {confirmElement}
    </>
  );
}

// 예적금 추가/수정 창 — 행을 누르면 같은 창이 수정 모드로 열린다 (상세 창은 따로 없다)
function SavingsModal({ state, savingCats, bankCats: allBanks, onClose, onSaved }: { state: ModalState; savingCats: Category[]; bankCats: Category[]; onClose: () => void; onSaved: () => void }) {
  const e = state.editing;
  // 은행 선택지 — 사용 중인 것 + 기존 값(비활성이어도)
  const bankCats = useMemo(() => activeWith(allBanks, (e ?? state.prefill)?.bank), [allBanks, e, state.prefill]);
  // 유형 선택지 — 라벨 · 순서는 코드 관리, 기존 값은 비활성이어도 남긴다
  const typeItems = useMemo(() => enumOptions(SAVING_TYPE_LABEL, savingCats, (e ?? state.prefill)?.type), [savingCats, e, state.prefill]);
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
    if (!bank.trim()) err.bank = '은행/기관을 선택하세요.';
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
      <div className="flex flex-col gap-1.5">
        <span className="text-[0.78rem] text-muted">유형<span className="text-danger"> *</span></span>
        <Segmented
          label="유형"
          variant="joined"
          fill
          value={type}
          onChange={setType}
          items={typeItems}
        />
      </div>
      <div className="grid grid-cols-2 gap-3 max-md:grid-cols-1">
        <Field label="은행/기관" required error={errors.bank}>
          <select className="input" aria-label="은행/기관" value={bank} onChange={(ev) => { setBank(ev.target.value); clearError('bank'); }}>
            <option value="" disabled>은행/기관 선택</option>
            {/* 코드 관리에 없는 값(지운 코드 · 옮기지 못한 옛 이름)이면 그대로 노출 */}
            {bank && !bankCats.some((b) => b.code === bank) && <option value={bank}>{bank}</option>}
            {bankCats.map((b) => <option key={b.code} value={b.code}>{b.label}</option>)}
          </select>
        </Field>
        <Field label="상품명" required error={errors.name}>
          <input type="text" className="input" placeholder="예: 26주 적금" value={name} onChange={(ev) => { setName(ev.target.value); clearError('name'); }} />
        </Field>
        <Field label="잔액">
          <UnitInput unit="₩" placeholder="0" value={balance} onChange={(ev) => setBalance(ev.target.value)} />
        </Field>
        <Field label="월 납입">
          <UnitInput unit="₩" placeholder="0" value={monthlyAmount} onChange={(ev) => setMonthlyAmount(ev.target.value)} />
        </Field>
        <Field label="금리">
          <UnitInput unit="%" side="right" step="0.1" placeholder="3.5" value={interestRate} onChange={(ev) => setInterestRate(ev.target.value)} />
        </Field>
        <div className="max-md:hidden" />
        <Field label="가입일" required error={errors.startDate}>
          <input type="date" className="input" aria-label="가입일" value={startDate} onChange={(ev) => { setStartDate(ev.target.value); clearError('startDate'); }} />
        </Field>
        <Field label="만기일">
          <input type="date" className="input" aria-label="만기일" value={maturityDate} onChange={(ev) => setMaturityDate(ev.target.value)} />
        </Field>
      </div>
      <Field label="메모 (선택)"><input type="text" className="input" placeholder="추가 메모" value={memo} onChange={(ev) => setMemo(ev.target.value)} /></Field>
    </Modal>
  );
}
