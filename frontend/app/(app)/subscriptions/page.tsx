'use client';

/**
 * 구독 관리 페이지.
 * 정기 결제를 표로 모아 결제 예정일·연 환산·마지막 사용을 추적한다.
 * 데이터는 백엔드 API(/subscriptions)와 실시간 연동한다.
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { notify } from '@/lib/toast';
import { useApiQuery, useInvalidate, type Paginated } from '@/lib/query';
import { useFormErrors } from '@/lib/useFormErrors';
import { usePagination } from '@/lib/usePagination';
import { qk } from '@/lib/queryKeys';
import { clickable } from '@/lib/a11y';
import AppShell from '@/components/AppShell';
import PageHeader from '@/components/PageHeader';
import { useConfirm } from '@/components/ConfirmModal';
import Pagination, { LimitSelect } from '@/components/Pagination';
import StatCard, { StatStrip } from '@/components/StatCard';
import ErrorBanner from '@/components/ErrorBanner';
import EmptyState from '@/components/EmptyState';
import TableEmptyRow from '@/components/TableEmptyRow';
import FilterPanel from '@/components/FilterPanel';
import Modal from '@/components/Modal';
import Button from '@/components/ui/Button';
import IconButton from '@/components/ui/IconButton';
import MoreMenu from '@/components/ui/MoreMenu';
import Segmented from '@/components/ui/Segmented';
import SearchInput from '@/components/ui/SearchInput';
import Badge from '@/components/ui/Badge';
import { Card, CardTitle } from '@/components/ui/Card';
import { Field, ModalFooter } from '@/components/ui/Field';
import { IconRepeat, IconAlertTriangle, IconPlus, IconEdit, IconTrash, IconCalendar, IconCube, IconClock } from '@/components/icons';
import { api } from '@/lib/api';
import { won, usd, dotDate, daysUntil, localDate } from '@/lib/finance';
import {
  SUB_CATEGORY_LABEL, SUB_CATEGORY_OPTIONS,
  CYCLE_LABEL, STATUS_LABEL, SUB_PAY_METHODS, SUB_CURRENCY_LABEL,
  type Subscription, type SubscriptionSummary,
  type SubscriptionCycle, type SubscriptionStatus,
} from '@/lib/subscription';

// 상태 → Badge tone
const STATUS_TONE: Record<SubscriptionStatus, 'success' | 'warning' | 'neutral'> = {
  active: 'success', trial: 'warning', paused: 'neutral',
};

const WEEKDAY = ['일', '월', '화', '수', '목', '금', '토'];
// 마지막 사용이 이만큼(일) 넘게 지나면 "안 쓴 구독"으로 센다
const STALE_DAYS = 90;
// 결제일이 이 일수 이내면 경고색
const SOON_DAYS = 3;

// 구독 금액 표시 (통화별)
function amountText(sub: Subscription) {
  return sub.currency === 'USD' ? usd(sub.amount) : won(sub.amount);
}

// 마지막 사용일 → 며칠 전인지 (오늘이면 0, 기록 없으면 null)
function daysAgo(lastUsedAt: string | null): number | null {
  const d = daysUntil(lastUsedAt);
  return d === null ? null : Math.max(0, -d);
}

export default function SubscriptionsPage() {
  // 구독 추가/수정 모달 상태 (편집 대상 포함)
  const [modal, setModal] = useState<{ open: boolean; mode: 'add' | 'edit'; editing?: Subscription }>({ open: false, mode: 'add' });
  const [pendingSearch, setPendingSearch] = useState('');
  const [search, setSearch] = useState('');
  const { page, setPage, limit, changeLimit } = usePagination();
  const { confirm, confirmElement } = useConfirm();
  const invalidate = useInvalidate();
  // mutation 후 구독 관련 쿼리 무효화
  const bump = () => invalidate(qk.subscriptions.all);

  // 조회 버튼(또는 Enter) 클릭 시에만 실제 필터에 반영
  function handleSearch() {
    setSearch(pendingSearch);
    setPage(1);
  }

  // 조회 조건 초기화
  function handleReset() {
    setPendingSearch('');
    setSearch('');
    setPage(1);
  }

  // 목록/요약 (React Query 캐시). 목록은 서버 페이징/검색
  const listQs = useMemo(() => {
    const params = new URLSearchParams();
    if (search.trim()) params.set('q', search.trim());
    params.set('page', String(page));
    params.set('limit', String(limit));
    return params.toString();
  }, [search, page, limit]);
  const subsQuery = useApiQuery<Paginated<Subscription>>(qk.subscriptions.list({ q: search.trim(), page, limit }), `/subscriptions?${listQs}`);
  const summaryQuery = useApiQuery<SubscriptionSummary>(['subscriptions', 'summary'], '/subscriptions/summary');
  // 결제 순서 띠 · 안 쓴 구독 수는 페이지와 무관하게 전체가 필요하다 (page 를 안 주면 전체 배열)
  const allQuery = useApiQuery<Subscription[]>(qk.subscriptions.list({ all: true }), '/subscriptions');
  const subs = useMemo(() => subsQuery.data?.items ?? [], [subsQuery.data]);
  const allSubs = useMemo(() => allQuery.data ?? [], [allQuery.data]);
  const total = subsQuery.data?.total ?? 0;
  const summary = summaryQuery.data ?? null;
  const error = (subsQuery.error ?? summaryQuery.error ?? allQuery.error)?.message ?? null;

  // 구독 해지 = 소프트 삭제 (목록에서 사라진다)
  async function handleCancel(id: number) {
    if (!await confirm('이 구독을 해지할까요? 목록에서 사라집니다.', 'danger')) return;
    try {
      await api.del(`/subscriptions/${id}`);
      notify.success('구독이 해지됐습니다.');
      bump();
    } catch {
      notify.error('해지에 실패했습니다.');
    }
  }

  // 체험 종료 임박 — 첫 체험 구독 (배너 노출용). 목록 페이징과 무관하게 요약에서 받음
  const trial = summary?.trial ?? null;

  const today = localDate();
  // 이번 달 남은 결제 순서 (일시정지 제외, 결제일 순)
  const payStrip = useMemo(() => {
    const month = today.slice(0, 7);
    return allSubs
      .filter((s) => s.status !== 'paused' && s.nextPaymentDate.startsWith(month) && s.nextPaymentDate >= today)
      .sort((a, b) => a.nextPaymentDate.localeCompare(b.nextPaymentDate));
  }, [allSubs, today]);
  const staleCount = useMemo(() => allSubs.filter((s) => (daysAgo(s.lastUsedAt) ?? 0) > STALE_DAYS).length, [allSubs]);
  const trialCount = allSubs.filter((s) => s.status === 'trial').length;

  const totalPages = Math.ceil(total / limit);

  return (
    <AppShell activePath="/subscriptions">
      <PageHeader
        title="구독 관리"
        description="정기 결제를 한눈에 — 결제 예정일 · 연 환산을 추적합니다."
        actions={<Button onClick={() => setModal({ open: true, mode: 'add' })}><IconPlus />구독 추가</Button>}
      />

      <ErrorBanner message={error} />

      {/* 상단 요약 통계 */}
      {summary && (
        <StatStrip>
          <StatCard icon={<IconRepeat />} tone="red" value={won(summary.monthlyTotal)} valueTone="out" label="월 구독료" change="월 환산 기준" />
          <StatCard icon={<IconCalendar />} tone="red" value={won(summary.yearlyTotal)} valueTone="out" label="연 환산" change="12개월 기준" />
          <StatCard icon={<IconCube />} tone="blue" value={`${summary.activeCount}건`} label="활성 구독" change={`체험 ${trialCount}건 포함 · 전체 ${allSubs.length}건`} />
          <StatCard icon={<IconClock />} tone="green" value={!summary.nextPayment ? '-' : summary.nextPayment.days === 0 ? '오늘' : `${summary.nextPayment.days}일`} label="다음 결제까지" change={summary.nextPayment?.name ?? '예정 없음'} />
        </StatStrip>
      )}

      {/* 체험 종료 임박 경고 상자 */}
      {trial && (
        <div className="flex items-start gap-2.5 px-3.5 py-3 border-t-2 border-warning bg-warning-dim mb-7 flex-wrap">
          <IconAlertTriangle width={16} height={16} className="text-warning shrink-0 mt-1" />
          <div className="flex-1 basis-60 text-[0.84rem]">
            <div className="font-semibold text-primary">무료 체험 종료 임박 — {trial.name}</div>
            <div className="text-muted">
              {dotDate(trial.nextPaymentDate)} 부터 {CYCLE_LABEL[trial.cycle]} {won(trial.amount)} 자동 결제됩니다.
              {(() => { const dd = daysUntil(trial.nextPaymentDate); return dd !== null && dd >= 0 ? ` 해지하려면 ${dd}일 남았습니다.` : ''; })()}
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={() => handleCancel(trial.id)}>지금 해지</Button>
        </div>
      )}

      {/* 이번 달 결제 순서 띠 */}
      <section className="flex flex-col gap-2.5 mb-7">
        <div className="flex items-baseline justify-between gap-3">
          <CardTitle>{Number(today.slice(5, 7))}월 결제 순서</CardTitle>
          <span className="text-[0.75rem] text-muted">오늘 {Number(today.slice(5, 7))}.{Number(today.slice(8, 10))} 이후</span>
        </div>
        {payStrip.length === 0 ? (
          <EmptyState size="sm" message="이번 달 남은 결제가 없습니다." />
        ) : (
          <div className="flex overflow-x-auto border-y border-border">
            {payStrip.map((s) => {
              const dd = daysUntil(s.nextPaymentDate);
              const soon = s.status === 'trial' || (dd !== null && dd <= SOON_DAYS);
              return (
                <div key={s.id} className="flex-[1_0_108px] flex flex-col gap-0.5 px-3 py-2.5 border-l border-border-subtle first:border-l-0">
                  <span className="text-[1.25rem] leading-tight tabular-nums">
                    {Number(s.nextPaymentDate.slice(8, 10))}
                    <span className="text-[0.72rem] text-muted ml-1">{WEEKDAY[new Date(`${s.nextPaymentDate}T00:00:00`).getDay()]}</span>
                  </span>
                  <span className="text-[0.8125rem] truncate">{s.name}</span>
                  <span className="text-[0.78rem] tabular-nums text-danger">−{amountText(s)}</span>
                  <span className={`text-[0.6875rem] ${soon ? 'text-warning' : 'text-muted'}`}>
                    {s.status === 'trial' ? '체험 종료' : dd === 0 ? '오늘' : `D-${dd}`}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 조회 조건 */}
      <FilterPanel className="mb-2">
        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          <div className="flex gap-2 flex-1">
            <SearchInput label="구독 검색" className="flex-1 min-w-0" placeholder="서비스명, 카테고리 검색" value={pendingSearch} onChange={(e) => setPendingSearch(e.target.value)} onEnter={handleSearch} />
            <Button onClick={handleSearch}>조회</Button>
          </div>
          <Button variant="ghost" className="w-full md:w-auto" onClick={handleReset}>초기화</Button>
        </div>
      </FilterPanel>
      {/* 총건 + 안 쓴 구독 + 페이지 크기 */}
      <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
        <span className="text-[0.8125rem]">총 <b className="font-semibold">{total}</b>건</span>
        <div className="flex items-center gap-3">
          {staleCount > 0 && (
            <span className="text-warning text-[0.8125rem] flex items-center gap-1.5"><IconClock width={13} height={13} />{STALE_DAYS}일 넘게 안 쓴 구독 {staleCount}건</span>
          )}
          <LimitSelect limit={limit} onLimitChange={changeLimit} />
        </div>
      </div>

      <Card clip className="mb-4">
        {/* PC: 표 */}
        <div className="table-wrap flat max-md:hidden">
          <table>
            <colgroup>
              <col />
              <col style={{ width: '88px' }} />
              <col style={{ width: '140px' }} />
              <col style={{ width: '170px' }} />
              <col style={{ width: '110px' }} />
              <col style={{ width: '150px' }} />
              <col style={{ width: '88px' }} />
            </colgroup>
            <thead>
              <tr>
                <th className="th-left">서비스</th>
                <th className="th-left">상태</th>
                <th className="td-right">금액</th>
                <th className="th-left">다음 결제</th>
                <th className="th-left">결제수단</th>
                <th className="th-left">마지막 사용</th>
                <th aria-label="관리" />
              </tr>
            </thead>
            <tbody>
              {subs.length === 0 && <TableEmptyRow colSpan={7} message="등록된 구독이 없습니다." />}
              {subs.map((sub) => {
                const dd = daysUntil(sub.nextPaymentDate);
                const ago = daysAgo(sub.lastUsedAt);
                const stale = ago !== null && ago > STALE_DAYS;
                return (
                  <tr key={sub.id} className="cursor-pointer" onClick={() => setModal({ open: true, mode: 'edit', editing: sub })}>
                    <td>
                      <div className="flex flex-col leading-snug">
                        <span>{sub.name}</span>
                        <span className="text-[0.75rem] text-muted">{SUB_CATEGORY_LABEL[sub.category] ?? sub.category}</span>
                      </div>
                    </td>
                    <td><Badge tone={STATUS_TONE[sub.status]}>{STATUS_LABEL[sub.status]}</Badge></td>
                    <td className="td-mono td-right">{amountText(sub)}<span className="text-[0.72rem] text-muted">/{CYCLE_LABEL[sub.cycle]}</span></td>
                    <td className="td-mono">
                      {dotDate(sub.nextPaymentDate)}
                      {dd !== null && dd >= 0 && <span className={`text-[0.75rem] ml-1 ${dd <= SOON_DAYS ? 'text-warning' : 'text-muted'}`}>D-{dd}</span>}
                    </td>
                    <td className="td-muted">{sub.payMethod}</td>
                    <td className={`td-mono ${stale ? 'text-warning' : 'td-muted'}`}>
                      {ago === null ? '-' : (
                        <span className="flex items-center gap-1.5">
                          {stale && <IconClock width={13} height={13} />}
                          {ago === 0 ? '오늘' : ago > STALE_DAYS ? `${ago}일 전` : dotDate(sub.lastUsedAt ?? '')}
                        </span>
                      )}
                    </td>
                    <td>
                      <div className="flex justify-end gap-0.5">
                        <IconButton label="수정" onClick={(e) => { e.stopPropagation(); setModal({ open: true, mode: 'edit', editing: sub }); }}><IconEdit /></IconButton>
                        <MoreMenu items={[{ label: '해지', icon: <IconTrash />, danger: true, onSelect: () => handleCancel(sub.id) }]} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* 휴대폰: 카드 줄 */}
        <div className="md:hidden">
          {subs.length === 0 && <EmptyState message="등록된 구독이 없습니다." />}
          {subs.map((sub) => (
            <div
              key={sub.id}
              className="flex items-center gap-3 px-4 py-2.5 min-h-14 border-b border-border-subtle last:border-b-0 cursor-pointer"
              onClick={() => setModal({ open: true, mode: 'edit', editing: sub })}
              {...clickable(() => setModal({ open: true, mode: 'edit', editing: sub }))}
            >
              <div className="flex-1 min-w-0 flex flex-col leading-snug">
                <span className="truncate">{sub.name}</span>
                <span className="text-[0.75rem] text-muted truncate">
                  {SUB_CATEGORY_LABEL[sub.category] ?? sub.category} · {STATUS_LABEL[sub.status]}
                </span>
              </div>
              <div className="flex flex-col items-end leading-snug shrink-0">
                <span className="tabular-nums">{amountText(sub)}<span className="text-[0.72rem] text-muted">/{CYCLE_LABEL[sub.cycle]}</span></span>
                <span className="text-[0.75rem] text-muted tabular-nums">{dotDate(sub.nextPaymentDate)}</span>
              </div>
              <MoreMenu size="lg" items={[{ label: '해지', icon: <IconTrash />, danger: true, onSelect: () => handleCancel(sub.id) }]} />
            </div>
          ))}
        </div>
        <Pagination page={page} totalPages={totalPages} totalItems={total} onPageChange={setPage} />
      </Card>

      {confirmElement}
      {/* 구독 추가/수정 모달 */}
      <SubscriptionModal
        state={modal}
        onClose={() => setModal((s) => ({ ...s, open: false }))}
        onSaved={() => { setModal((s) => ({ ...s, open: false })); bump(); }}
      />
    </AppShell>
  );
}

// 구독 추가 창의 번호 붙은 묶음 (1 무엇을 · 2 결제)
function FormGroup({ no, title, first, children }: { no: number; title: string; first?: boolean; children: ReactNode }) {
  return (
    <div className={`flex flex-col gap-3 ${first ? '' : 'pt-4 border-t border-border-subtle'}`}>
      <div className="flex items-baseline gap-2 text-[0.78rem] text-accent-dark">
        <span className="[font-family:var(--font-display)] font-semibold text-[1.0625rem] lining-nums">{no}</span>{title}
      </div>
      {children}
    </div>
  );
}

// 구독 추가·수정 모달
function SubscriptionModal({ state, onClose, onSaved }: { state: { open: boolean; mode: 'add' | 'edit'; editing?: Subscription }; onClose: () => void; onSaved: () => void }) {
  const e = state.editing;
  const [name, setName] = useState('');
  const [category, setCategory] = useState('ott');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState<'KRW' | 'USD'>('KRW');
  const [cycle, setCycle] = useState<SubscriptionCycle>('monthly');
  const [nextPaymentDate, setNextPaymentDate] = useState('');
  const [status, setStatus] = useState<SubscriptionStatus>('active');
  const [payMethod, setPayMethod] = useState(SUB_PAY_METHODS[0]);
  const [lastUsedAt, setLastUsedAt] = useState('');
  const [memo, setMemo] = useState('');
  const [saving, setSaving] = useState(false);
  const { errors, setErrors, clearError, reset } = useFormErrors();

  useEffect(() => {
    if (!state.open) return;
    reset();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 모달 열릴 때 폼 초기화
    setName(e?.name ?? '');
    setCategory(e?.category ?? 'ott');
    setAmount(e ? String(e.amount) : '');
    setCurrency(e?.currency ?? 'KRW');
    setCycle(e?.cycle ?? 'monthly');
    setNextPaymentDate(e?.nextPaymentDate ?? localDate());
    setStatus(e?.status ?? 'active');
    setPayMethod(e?.payMethod ?? SUB_PAY_METHODS[0]);
    setLastUsedAt(e?.lastUsedAt ?? '');
    setMemo(e?.memo ?? '');
  }, [state.open, e, reset]);

  function validate() {
    const err: Record<string, string> = {};
    if (!name.trim()) err.name = '서비스명을 입력하세요.';
    if (!amount || Number(amount) <= 0) err.amount = '금액을 입력하세요.';
    if (!nextPaymentDate) err.nextPaymentDate = '다음 결제일을 선택하세요.';
    setErrors(err);
    return !Object.keys(err).length;
  }

  async function handleSave() {
    if (!validate()) return;
    setSaving(true);
    try {
      const payload = {
        name, category, amount: Number(amount), currency, cycle, status,
        nextPaymentDate, payMethod,
        lastUsedAt: lastUsedAt || undefined, memo: memo || undefined,
      };
      if (state.mode === 'edit' && e) await api.put(`/subscriptions/${e.id}`, payload);
      else await api.post('/subscriptions', payload);
      notify.upserted(state.mode, '구독');
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
      title={state.mode === 'edit' ? '구독 수정' : '구독 추가'}
      footer={<ModalFooter onClose={onClose} onSave={handleSave} saving={saving} />}
    >
      <FormGroup no={1} title="무엇을" first>
        <div className="grid grid-cols-2 gap-3 max-md:grid-cols-1">
          <Field label="서비스명" required error={errors.name}>
            <input type="text" className="input" placeholder="예: 넷플릭스" value={name} onChange={(ev) => { setName(ev.target.value); clearError('name'); }} />
          </Field>
          <Field label="카테고리">
            <select className="input" aria-label="카테고리" value={category} onChange={(ev) => setCategory(ev.target.value)}>
              {SUB_CATEGORY_OPTIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </Field>
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-[0.78rem] text-muted">상태</span>
          <Segmented
            variant="joined"
            label="상태"
            value={status}
            onChange={setStatus}
            items={[
              { value: 'active', label: STATUS_LABEL.active },
              { value: 'trial', label: STATUS_LABEL.trial },
              { value: 'paused', label: STATUS_LABEL.paused },
            ]}
          />
        </div>
      </FormGroup>
      <FormGroup no={2} title="결제">
        <div className="grid grid-cols-2 gap-3 max-md:grid-cols-1">
          <Field label="금액" required error={errors.amount}>
            <div className="grid grid-cols-[minmax(0,1fr)_96px] gap-1.5">
              <input type="number" className="input text-right" placeholder="0" aria-label="금액" value={amount} onChange={(ev) => { setAmount(ev.target.value); clearError('amount'); }} />
              <select className="input" aria-label="통화" value={currency} onChange={(ev) => setCurrency(ev.target.value as 'KRW' | 'USD')}>
                {(Object.keys(SUB_CURRENCY_LABEL) as ('KRW' | 'USD')[]).map((c) => <option key={c} value={c}>{SUB_CURRENCY_LABEL[c]}</option>)}
              </select>
            </div>
          </Field>
          <Field label="결제수단">
            <select className="input" aria-label="결제수단" value={payMethod} onChange={(ev) => setPayMethod(ev.target.value)}>
              {SUB_PAY_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </Field>
          <Field label="주기" required>
            <select className="input" aria-label="결제 주기" value={cycle} onChange={(ev) => setCycle(ev.target.value as SubscriptionCycle)}>
              <option value="monthly">매월</option><option value="yearly">매년</option><option value="weekly">매주</option>
            </select>
          </Field>
          <Field label="다음 결제일" required error={errors.nextPaymentDate}>
            <input type="date" className="input" aria-label="다음 결제일" value={nextPaymentDate} onChange={(ev) => { setNextPaymentDate(ev.target.value); clearError('nextPaymentDate'); }} />
          </Field>
          <Field label="마지막 사용일 (선택)">
            <input type="date" className="input" aria-label="마지막 사용일" value={lastUsedAt} onChange={(ev) => setLastUsedAt(ev.target.value)} />
          </Field>
          <Field label="메모 (선택)">
            <input type="text" className="input" placeholder="추가 정보" value={memo} onChange={(ev) => setMemo(ev.target.value)} />
          </Field>
        </div>
      </FormGroup>
    </Modal>
  );
}
