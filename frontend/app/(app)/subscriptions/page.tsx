'use client';

/**
 * 구독 관리 페이지.
 * 정기 결제를 카드로 모아 결제 예정일·연 환산을 추적한다.
 * 데이터는 백엔드 API(/subscriptions)와 실시간 연동한다.
 * 스타일: Tailwind + 공통 컴포넌트(StatCard/Button/Badge/Card/Modal/Field). 메인 목록은 카드형 유지.
 */
import { useEffect, useMemo, useState } from 'react';
import { notify } from '@/lib/toast';
import { useApiQuery, useInvalidate, type Paginated } from '@/lib/query';
import { useFormErrors } from '@/lib/useFormErrors';
import { usePagination } from '@/lib/usePagination';
import { qk } from '@/lib/queryKeys';
import AppShell from '@/components/AppShell';
import PageHeader from '@/components/PageHeader';
import { useConfirm } from '@/components/ConfirmModal';
import Pagination, { LimitSelect } from '@/components/Pagination';
import StatCard, { StatStrip } from '@/components/StatCard';
import ErrorBanner from '@/components/ErrorBanner';
import EmptyState from '@/components/EmptyState';
import Modal from '@/components/Modal';
import Button from '@/components/ui/Button';
import SearchInput from '@/components/ui/SearchInput';
import Badge from '@/components/ui/Badge';
import { Field, ModalFooter } from '@/components/ui/Field';
import { IconRepeat, IconAlertTriangle } from '@/components/icons';
import { api } from '@/lib/api';
import { won, usd, dotDate, daysUntil, localDate } from '@/lib/finance';
import { Card } from '@/components/ui/Card';
import {
  SUB_CATEGORY_LABEL, SUB_CATEGORY_EMOJI, SUB_CATEGORY_OPTIONS,
  CYCLE_LABEL, STATUS_LABEL, SUB_PAY_METHODS, SUB_CURRENCY_LABEL,
  type Subscription, type SubscriptionSummary,
  type SubscriptionCycle, type SubscriptionStatus,
} from '@/lib/subscription';

// 상태 → Badge tone
const STATUS_TONE: Record<SubscriptionStatus, 'success' | 'warning' | 'neutral'> = {
  active: 'success', trial: 'warning', paused: 'neutral',
};

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

  // 검색 버튼(또는 Enter) 클릭 시에만 실제 필터에 반영
  function handleSearch() {
    setSearch(pendingSearch);
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
  const subs = useMemo(() => subsQuery.data?.items ?? [], [subsQuery.data]);
  const total = subsQuery.data?.total ?? 0;
  const summary = summaryQuery.data ?? null;
  const error = (subsQuery.error ?? summaryQuery.error)?.message ?? null;

  // 구독 해지 (soft delete)
  async function handleCancel(id: number) {
    if (!await confirm('이 구독을 해지할까요?', 'danger')) return;
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

  const stats = summary
    ? [
        { tone: 'red' as const, icon: <IconRepeat />, value: won(summary.monthlyTotal), label: '월 구독료 합계', change: '월 환산 기준', changeDir: 'neutral' as const },
        { tone: 'amber' as const, icon: '📅', value: won(summary.yearlyTotal), label: '연 환산 비용', change: '= 12개월 기준', changeDir: 'neutral' as const },
        { tone: 'blue' as const, icon: '📦', value: String(summary.activeCount), label: '활성 구독', change: `${summary.activeCount}건 결제 중`, changeDir: 'neutral' as const },
        { tone: 'green' as const, icon: '⏰', value: summary.nextPayment ? `${summary.nextPayment.days}일` : '-', label: '다음 결제까지', change: summary.nextPayment?.name ?? '예정 없음', changeDir: 'neutral' as const },
      ]
    : [];

  const totalPages = Math.ceil(total / limit);
  const paged = subs; // 서버가 이미 검색+페이지 단위로 잘라서 보냄

  return (
    <AppShell activePath="/subscriptions" topbarLabel="구독 관리">
      <PageHeader
        title="구독 관리"
        description="정기 결제를 한눈에 — 결제 예정일·연 환산을 추적합니다."
        actions={<Button onClick={() => setModal({ open: true, mode: 'add' })}>구독 추가</Button>}
      />

      <ErrorBanner message={error} />

      {/* 상단 요약 통계 */}
      <StatStrip>
        {stats.map((s) => (
          <StatCard key={s.label} icon={s.icon} tone={s.tone} value={s.value} label={s.label} change={s.change} changeDir={s.changeDir} />
        ))}
      </StatStrip>

      {/* 체험 종료 임박 경고 배너 */}
      {trial && (
        <div className="flex items-center gap-3 px-[18px] py-3.5 rounded-panel bg-warning-dim border border-warning/20 mb-6">
          <IconAlertTriangle width={20} height={20} className="text-warning shrink-0" />
          <div className="flex-1">
            <div className="font-semibold text-[0.875rem] text-primary">무료 체험 종료 임박 — {trial.name}</div>
            <div className="text-[0.8rem] text-secondary">
              {dotDate(trial.nextPaymentDate)} 부터 {CYCLE_LABEL[trial.cycle]} {won(trial.amount)} 자동 결제됩니다.
              {(() => { const dd = daysUntil(trial.nextPaymentDate); return dd !== null && dd >= 0 ? ` 해지하려면 ${dd}일 남았습니다.` : ''; })()}
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={() => handleCancel(trial.id)}>지금 해지</Button>
        </div>
      )}

      {/* 검색 필터 — PC: 카드 박스, 모바일: 스타일 없음 */}
      <div className="md:bg-surface md:border md:border-border md:rounded-ui md:px-4 md:py-3 mb-2">
        <div className="flex gap-2">
          <SearchInput label="구독 검색" className="flex-1 min-w-0" placeholder="서비스명, 카테고리 검색..." value={pendingSearch} onChange={(e) => setPendingSearch(e.target.value)} onEnter={handleSearch} />
          <Button onClick={handleSearch}>검색</Button>
        </div>
      </div>
      {/* 총건 + 페이지 크기 */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-muted text-[0.82rem]">총 {total}건</span>
        <LimitSelect limit={limit} onLimitChange={changeLimit} />
      </div>

      {/* 구독 카드 그리드 (도메인 특성상 카드형 유지) */}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4 mb-7">
        {paged.length === 0 && <EmptyState size="sm" message="등록된 구독이 없습니다." className="mb-3" />}
        {paged.map((sub) => {
          const dd = daysUntil(sub.nextPaymentDate);
          return (
            <Card hover="lift" className="p-[18px]" key={sub.id}>
              <div className="flex items-center gap-3 mb-3.5">
                <div className="w-[42px] h-[42px] rounded-ui bg-surface border border-border flex items-center justify-center text-[1.3rem] shrink-0">{SUB_CATEGORY_EMOJI[sub.category] ?? '🧩'}</div>
                <div className="flex-1">
                  <div className="[font-family:var(--font-display)] font-bold text-[0.95rem] text-primary">{sub.name}</div>
                  <div className="text-[0.72rem] text-muted">{SUB_CATEGORY_LABEL[sub.category] ?? sub.category}</div>
                </div>
                <Badge tone={STATUS_TONE[sub.status]}>{STATUS_LABEL[sub.status]}</Badge>
              </div>
              <div className="[font-family:var(--font-display)] text-[1.4rem] font-bold text-primary tracking-[-0.03em]">
                {sub.currency === 'USD' ? usd(sub.amount) : won(sub.amount)}<span className="text-[0.75rem] text-muted ml-1 font-normal [font-family:var(--font-body)]">/{CYCLE_LABEL[sub.cycle]}</span>
              </div>
              <div className="flex flex-col gap-1.5 my-3 text-[0.78rem]">
                <div className="flex justify-between">
                  <span className="text-muted">다음 결제</span>
                  <span>{dotDate(sub.nextPaymentDate)} {dd !== null && dd >= 0 && <span className="text-warning font-semibold">D-{dd}</span>}</span>
                </div>
                <div className="flex justify-between"><span className="text-muted">결제수단</span><span>{sub.payMethod}</span></div>
              </div>
              <div className="flex gap-2 pt-3 border-t border-border-subtle">
                <Button variant="ghost" className="flex-1" onClick={() => setModal({ open: true, mode: 'edit', editing: sub })}>수정</Button>
                <Button variant="danger" className="flex-1" onClick={() => handleCancel(sub.id)}>해지</Button>
              </div>
            </Card>
          );
        })}
      </div>
      <Pagination page={page} totalPages={totalPages} totalItems={total} onPageChange={setPage} />

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
      <Field label="서비스명" required error={errors.name}>
        <input type="text" className="input" placeholder="예: 넷플릭스" value={name} onChange={(ev) => { setName(ev.target.value); clearError('name'); }} />
      </Field>
      <Field label="카테고리" required>
        <select className="input" aria-label="카테고리" value={category} onChange={(ev) => setCategory(ev.target.value)}>
          {SUB_CATEGORY_OPTIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-4 max-md:grid-cols-1">
        <Field label="금액" required error={errors.amount}>
          <input type="number" className="input" placeholder="0" value={amount} onChange={(ev) => { setAmount(ev.target.value); clearError('amount'); }} />
        </Field>
        <Field label="통화" required>
          <select className="input" aria-label="통화" value={currency} onChange={(ev) => setCurrency(ev.target.value as 'KRW' | 'USD')}>
            {(Object.keys(SUB_CURRENCY_LABEL) as ('KRW' | 'USD')[]).map((c) => <option key={c} value={c}>{SUB_CURRENCY_LABEL[c]}</option>)}
          </select>
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-4 max-md:grid-cols-1">
        <Field label="결제 주기" required>
          <select className="input" aria-label="결제 주기" value={cycle} onChange={(ev) => setCycle(ev.target.value as SubscriptionCycle)}>
            <option value="monthly">매월</option><option value="yearly">매년</option><option value="weekly">매주</option>
          </select>
        </Field>
        <Field label="다음 결제일" required error={errors.nextPaymentDate}>
          <input type="date" className="input" aria-label="다음 결제일" value={nextPaymentDate} onChange={(ev) => { setNextPaymentDate(ev.target.value); clearError('nextPaymentDate'); }} />
        </Field>
      </div>
      <Field label="상태">
        <select className="input" aria-label="상태" value={status} onChange={(ev) => setStatus(ev.target.value as SubscriptionStatus)}>
          <option value="active">활성</option><option value="trial">체험</option><option value="paused">일시정지</option>
        </select>
      </Field>
      <Field label="결제수단" required>
        <select className="input" aria-label="결제수단" value={payMethod} onChange={(ev) => setPayMethod(ev.target.value)}>
          {SUB_PAY_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
      </Field>
      <Field label="마지막 사용일 (선택)"><input type="date" className="input" aria-label="마지막 사용일" value={lastUsedAt} onChange={(ev) => setLastUsedAt(ev.target.value)} /></Field>
      <Field label="메모 (선택)"><input type="text" className="input" placeholder="간단한 메모" value={memo} onChange={(ev) => setMemo(ev.target.value)} /></Field>
    </Modal>
  );
}
