'use client';

/**
 * 구독 관리 페이지.
 * 정기 결제를 카드로 모아 결제 예정일·연 환산·미사용 의심 구독을 추적한다.
 * 데이터는 백엔드 API(/subscriptions)와 실시간 연동한다.
 */
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import AppShell from '@/components/AppShell';
import StatCard from '@/components/StatCard';
import Modal from '@/components/Modal';
import { IconRepeat, IconAlertTriangle } from '@/components/icons';
import { api } from '@/lib/api';
import { won, dotDate, daysUntil } from '@/lib/finance';
import {
  SUB_CATEGORY_LABEL, SUB_CATEGORY_EMOJI, SUB_CATEGORY_OPTIONS,
  CYCLE_LABEL, STATUS_LABEL, STATUS_BADGE, SUB_PAY_METHODS,
  type Subscription, type SubscriptionSummary, type UnusedSubscription,
  type SubscriptionCycle, type SubscriptionStatus,
} from '@/lib/subscription';

export default function SubscriptionsPage() {
  // 구독 추가/수정 모달 상태 (편집 대상 포함)
  const [modal, setModal] = useState<{ open: boolean; mode: 'add' | 'edit'; editing?: Subscription }>({ open: false, mode: 'add' });
  // mutation 후 증가시켜 전체 데이터 재조회
  const [reload, setReload] = useState(0);
  const bump = () => setReload((n) => n + 1);

  const [subs, setSubs] = useState<Subscription[]>([]);
  const [summary, setSummary] = useState<SubscriptionSummary | null>(null);
  const [unused, setUnused] = useState<UnusedSubscription[]>([]);
  const [error, setError] = useState<string | null>(null);

  // 목록/요약/미사용 조회
  const load = useCallback(async () => {
    try {
      const [list, s, u] = await Promise.all([
        api.get<Subscription[]>('/subscriptions'),
        api.get<SubscriptionSummary>('/subscriptions/summary'),
        api.get<UnusedSubscription[]>('/subscriptions/unused'),
      ]);
      setSubs(list); setSummary(s); setUnused(u); setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => { load(); }, [load, reload]);

  // 구독 해지 (soft delete)
  async function cancel(id: number) {
    if (!window.confirm('이 구독을 해지할까요?')) return;
    await api.del(`/subscriptions/${id}`);
    bump();
  }

  // 체험 종료 임박 — 첫 체험 구독 (배너 노출용)
  const trial = subs.find((s) => s.status === 'trial');

  const stats = summary
    ? [
        { tone: 'red' as const, icon: <IconRepeat />, value: won(summary.monthlyTotal), label: '월 구독료 합계', change: '월 환산 기준', changeDir: 'neutral' as const },
        { tone: 'amber' as const, icon: '📅', value: won(summary.yearlyTotal), label: '연 환산 비용', change: '= 12개월 기준', changeDir: 'neutral' as const },
        { tone: 'blue' as const, icon: '📦', value: String(summary.activeCount), label: '활성 구독', change: `${summary.activeCount}건 결제 중`, changeDir: 'neutral' as const },
        { tone: 'green' as const, icon: '⏰', value: summary.nextPayment ? `${summary.nextPayment.days}일` : '-', label: '다음 결제까지', change: summary.nextPayment?.name ?? '예정 없음', changeDir: 'neutral' as const },
      ]
    : [];

  return (
    <AppShell
      activePath="/subscriptions"
      topbarLabel="구독 관리"
      actionLabel="구독 추가"
      onAction={() => setModal({ open: true, mode: 'add' })}
    >
      <div className="page-header">
        <h1 className="page-title">구독 관리</h1>
        <p className="page-subtitle">정기 결제를 한눈에 — 결제 예정일·연 환산·미사용 구독을 추적합니다.</p>
      </div>

      {error && <p className="ledger-note is-error">⚠️ {error}</p>}

      {/* 상단 요약 통계 */}
      <div className="grid-4 mb-8">
        {stats.map((s) => (
          <StatCard key={s.label} icon={s.icon} tone={s.tone} value={s.value} label={s.label} change={s.change} changeDir={s.changeDir} />
        ))}
      </div>

      {/* 체험 종료 임박 경고 배너 */}
      {trial && (
        <div className="alert-banner">
          <IconAlertTriangle width={20} height={20} />
          <div className="alert-body">
            <div className="alert-title">무료 체험 종료 임박 — {trial.name}</div>
            <div className="alert-desc">
              {dotDate(trial.nextPaymentDate)} 부터 {CYCLE_LABEL[trial.cycle]} {won(trial.amount)} 자동 결제됩니다.
              {(() => { const dd = daysUntil(trial.nextPaymentDate); return dd !== null && dd >= 0 ? ` 해지하려면 ${dd}일 남았습니다.` : ''; })()}
            </div>
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => cancel(trial.id)}>지금 해지</button>
        </div>
      )}

      {/* 구독 카드 그리드 */}
      <div className="sub-grid">
        {subs.length === 0 && <p className="muted-note">등록된 구독이 없습니다.</p>}
        {subs.map((sub) => {
          const dd = daysUntil(sub.nextPaymentDate);
          return (
            <div className="sub-card" key={sub.id}>
              <div className="sub-top">
                <div className="sub-logo">{SUB_CATEGORY_EMOJI[sub.category] ?? '🧩'}</div>
                <div className="sub-head">
                  <div className="sub-name">{sub.name}</div>
                  <div className="sub-cat">{SUB_CATEGORY_LABEL[sub.category] ?? sub.category}</div>
                </div>
                <span className={`badge ${STATUS_BADGE[sub.status]}`}>{STATUS_LABEL[sub.status]}</span>
              </div>
              <div className="sub-price">{won(sub.amount)}<span className="sub-cycle">/{CYCLE_LABEL[sub.cycle]}</span></div>
              <div className="sub-meta">
                <div className="sub-meta-row">
                  <span className="l">다음 결제</span>
                  <span>{dotDate(sub.nextPaymentDate)} {dd !== null && dd >= 0 && <span className="sub-dday">D-{dd}</span>}</span>
                </div>
                <div className="sub-meta-row"><span className="l">결제수단</span><span>{sub.payMethod}</span></div>
              </div>
              <div className="sub-actions">
                <button type="button" className="btn btn-ghost grow" onClick={() => setModal({ open: true, mode: 'edit', editing: sub })}>수정</button>
                <button type="button" className="btn btn-danger" onClick={() => cancel(sub.id)}>해지</button>
              </div>
            </div>
          );
        })}
      </div>

      {/* 미사용 의심 구독 */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">⚠️ 미사용 의심 구독</span>
          <span className="badge badge-warning">{unused.length}건</span>
        </div>
        <div className="card-body">
          <p className="muted-note">최근 30일간 관련 활동(앱 실행/결제 외 사용)이 감지되지 않은 구독입니다.</p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>서비스</th><th>월 비용</th><th>마지막 사용 추정</th><th className="td-center">액션</th></tr>
              </thead>
              <tbody>
                {unused.length === 0 && (
                  <tr><td colSpan={4} className="td-center td-muted">미사용 의심 구독이 없습니다.</td></tr>
                )}
                {unused.map((u) => (
                  <tr key={u.id}>
                    <td>{SUB_CATEGORY_EMOJI[u.category] ?? '🧩'} {u.name}</td>
                    <td className="td-mono">{won(u.monthlyCost)}</td>
                    <td className="td-muted">{u.daysSince !== null ? `${u.daysSince}일 전` : `미사용${u.status === 'trial' ? ' (체험)' : ''}`}</td>
                    <td className="td-center">
                      <button type="button" className="btn btn-danger btn-sm" onClick={() => cancel(u.id)}>해지 검토</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

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
  const [cycle, setCycle] = useState<SubscriptionCycle>('monthly');
  const [nextPaymentDate, setNextPaymentDate] = useState('');
  const [status, setStatus] = useState<SubscriptionStatus>('active');
  const [payMethod, setPayMethod] = useState(SUB_PAY_METHODS[0]);
  const [lastUsedAt, setLastUsedAt] = useState('');
  const [memo, setMemo] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // 모달 열릴 때 폼 초기화 (편집 시 기존 값, 추가 시 기본값)
  useEffect(() => {
    if (!state.open) return;
    setErr(null);
    setName(e?.name ?? '');
    setCategory(e?.category ?? 'ott');
    setAmount(e ? String(e.amount) : '');
    setCycle(e?.cycle ?? 'monthly');
    setNextPaymentDate(e?.nextPaymentDate ?? new Date().toISOString().slice(0, 10));
    setStatus(e?.status ?? 'active');
    setPayMethod(e?.payMethod ?? SUB_PAY_METHODS[0]);
    setLastUsedAt(e?.lastUsedAt ?? '');
    setMemo(e?.memo ?? '');
  }, [state.open, e]);

  async function save() {
    setSaving(true); setErr(null);
    try {
      const payload = {
        name, category, amount: Number(amount), cycle, status,
        nextPaymentDate, payMethod,
        lastUsedAt: lastUsedAt || undefined, memo: memo || undefined,
      };
      if (state.mode === 'edit' && e) await api.put(`/subscriptions/${e.id}`, payload);
      else await api.post('/subscriptions', payload);
      onSaved();
    } catch (x) {
      setErr((x as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={state.open}
      onClose={onClose}
      title={state.mode === 'edit' ? '구독 수정' : '구독 추가'}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>취소</button>
          <button type="button" className="btn btn-primary" onClick={save} disabled={saving}>{saving ? '저장 중...' : '저장'}</button>
        </>
      }
    >
      {err && <p className="input-error">⚠️ {err}</p>}
      <Field label="서비스명"><input type="text" className="input" placeholder="예: 넷플릭스" value={name} onChange={(ev) => setName(ev.target.value)} /></Field>
      <Field label="카테고리">
        <select className="input" aria-label="카테고리" value={category} onChange={(ev) => setCategory(ev.target.value)}>
          {SUB_CATEGORY_OPTIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
      </Field>
      <div className="form-grid-2">
        <Field label="금액 (원)"><input type="number" className="input" placeholder="0" value={amount} onChange={(ev) => setAmount(ev.target.value)} /></Field>
        <Field label="결제 주기">
          <select className="input" aria-label="결제 주기" value={cycle} onChange={(ev) => setCycle(ev.target.value as SubscriptionCycle)}>
            <option value="monthly">매월</option><option value="yearly">매년</option><option value="weekly">매주</option>
          </select>
        </Field>
      </div>
      <div className="form-grid-2">
        <Field label="다음 결제일"><input type="date" className="input" aria-label="다음 결제일" value={nextPaymentDate} onChange={(ev) => setNextPaymentDate(ev.target.value)} /></Field>
        <Field label="상태">
          <select className="input" aria-label="상태" value={status} onChange={(ev) => setStatus(ev.target.value as SubscriptionStatus)}>
            <option value="active">활성</option><option value="trial">체험</option><option value="paused">일시정지</option>
          </select>
        </Field>
      </div>
      <Field label="결제수단">
        <select className="input" aria-label="결제수단" value={payMethod} onChange={(ev) => setPayMethod(ev.target.value)}>
          {SUB_PAY_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
      </Field>
      <Field label="마지막 사용일 (선택)"><input type="date" className="input" aria-label="마지막 사용일" value={lastUsedAt} onChange={(ev) => setLastUsedAt(ev.target.value)} /></Field>
      <Field label="메모 (선택)"><input type="text" className="input" placeholder="간단한 메모" value={memo} onChange={(ev) => setMemo(ev.target.value)} /></Field>
    </Modal>
  );
}

// 입력 그룹 (라벨 + 입력요소). label 로 감싸 입력요소에 접근성 이름을 연결한다.
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="input-group">
      <span className="input-label">{label}</span>
      {children}
    </label>
  );
}
