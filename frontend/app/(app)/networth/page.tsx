'use client';

/**
 * 자산 종합 페이지.
 * 순자산(자산 − 부채)을 도넛 구성·6개월 추이·부채 내역으로 추적한다.
 * 데이터는 백엔드 API(/assets)와 실시간 연동한다.
 */
import { useCallback, useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import AppShell from '@/components/AppShell';
import StatCard from '@/components/StatCard';
import Modal from '@/components/Modal';
import { api } from '@/lib/api';
import { won } from '@/lib/finance';
import {
  ASSET_TYPE_LABEL, ASSET_TYPE_COLOR, ASSET_TYPE_OPTIONS, BY_TYPE_CARD,
  wonM, millionsLabel,
  type Asset, type NetWorthSummary, type TrendPoint, type AllocationItem, type AssetType,
} from '@/lib/networth';

// 도넛 conic-gradient 문자열 생성 (누적 percent 기준)
function buildDonutGradient(items: AllocationItem[]): string {
  let acc = 0;
  const stops = items.map((it) => {
    const color = ASSET_TYPE_COLOR[it.type];
    const seg = `${color} ${acc}% ${acc + it.percent}%`;
    acc += it.percent;
    return seg;
  });
  return `conic-gradient(${stops.join(', ')})`;
}

export default function NetworthPage() {
  // 자산 추가/수정 모달 상태 (편집 대상 포함)
  const [modal, setModal] = useState<{ open: boolean; mode: 'add' | 'edit'; editing?: Asset }>({ open: false, mode: 'add' });
  const [reload, setReload] = useState(0);
  const bump = () => setReload((n) => n + 1);

  const [summary, setSummary] = useState<NetWorthSummary | null>(null);
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [error, setError] = useState<string | null>(null);

  // 요약/추이/목록 조회
  const load = useCallback(async () => {
    try {
      const [s, t, list] = await Promise.all([
        api.get<NetWorthSummary>('/assets/summary'),
        api.get<TrendPoint[]>('/assets/trend'),
        api.get<Asset[]>('/assets'),
      ]);
      setSummary(s); setTrend(t); setAssets(list); setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => { load(); }, [load, reload]);

  // 자산/부채 삭제
  async function remove(id: number) {
    if (!window.confirm('이 항목을 삭제할까요?')) return;
    await api.del(`/assets/${id}`);
    bump();
  }

  const debts = assets.filter((a) => a.type === 'debt');
  const maxTrend = Math.max(1, ...trend.map((t) => t.netWorth));
  const up = (summary?.changeAmount ?? 0) >= 0;

  // 유형별 카드 — byType 항목에 카드 메타(아이콘/톤/라벨) 결합
  const cards = (summary?.byType ?? []).map((b) => {
    const meta = BY_TYPE_CARD[b.type];
    const change =
      b.type === 'cash' ? `입출금 ${b.count}건`
      : b.type === 'savings' ? (b.avgRate !== null ? `평균 ${b.avgRate}%` : `${b.count}건`)
      : b.type === 'investment' ? `${b.count}종목`
      : `${b.count}건`;
    return { ...b, ...meta, value: wonM(b.amount), change };
  });

  return (
    <AppShell
      activePath="/networth"
      topbarLabel="자산 종합"
      actionLabel="자산 추가"
      onAction={() => setModal({ open: true, mode: 'add' })}
    >
      <div className="page-header">
        <h1 className="page-title">자산 종합</h1>
        <p className="page-subtitle">순자산 = 자산 − 부채. 현금·예적금·투자·부동산을 합산해 추적합니다.</p>
      </div>

      {error && <p className="ledger-note is-error">⚠️ {error}</p>}

      {summary && (
        <>
          {/* 히어로 — 총 순자산 + 도넛 + 범례 */}
          <div className="nw-hero">
            <div className="nw-hero-main">
              <div className="nw-hero-label">총 순자산</div>
              <div className="nw-hero-value">{won(summary.netWorth)}</div>
              <div className="nw-hero-change">
                {up ? '▲' : '▼'} {won(summary.changeAmount)} ({summary.changeRate}%) 지난달 대비
              </div>
            </div>
            <div className="donut" style={{ background: buildDonutGradient(summary.allocation) }}>
              <div className="donut-label">
                <div className="t">자산</div>
                <div className="v">{wonM(summary.totalAssets)}</div>
              </div>
            </div>
            <div className="legend">
              {summary.allocation.map((a) => (
                <div className="legend-row" key={a.type}>
                  <span className="legend-dot" style={{ background: ASSET_TYPE_COLOR[a.type] }} />
                  {ASSET_TYPE_LABEL[a.type]} {wonM(a.amount)} ({a.percent}%)
                </div>
              ))}
            </div>
          </div>

          {/* 자산 유형별 통계 */}
          <div className="grid-4 mb-8">
            {cards.map((c) => (
              <StatCard key={c.type} icon={c.icon} tone={c.tone} value={c.value} label={c.label} change={c.change} changeDir="neutral" />
            ))}
          </div>
        </>
      )}

      {/* 추이 막대 + 부채 테이블 */}
      <div className="grid-2 mb-6">
        <div className="card">
          <div className="card-header"><span className="card-title">순자산 추이 (6개월)</span></div>
          <div className="card-body">
            <div className="bars">
              {trend.map((t) => (
                <div
                  key={t.month}
                  className={`bar${t.current ? ' current' : ''}`}
                  style={{ height: `${Math.round((t.netWorth / maxTrend) * 100)}%` } as CSSProperties}
                >
                  <span>{millionsLabel(t.netWorth)}</span>
                  <small>{t.label}</small>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title">부채</span>
            <span className="badge badge-danger">{summary ? wonM(summary.totalDebt) : '-'}</span>
          </div>
          <div className="card-body flush">
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>항목</th><th className="td-right">잔액</th>
                    <th className="td-right">금리</th><th className="td-center">액션</th>
                  </tr>
                </thead>
                <tbody>
                  {debts.length === 0 && (
                    <tr><td colSpan={4} className="td-center td-muted">부채가 없습니다.</td></tr>
                  )}
                  {debts.map((d) => (
                    <tr key={d.id}>
                      <td className="td-name">{d.name}</td>
                      <td className="td-mono td-right">{won(d.amount)}</td>
                      <td className="td-right">{d.interestRate !== null ? `${d.interestRate}%` : '-'}</td>
                      <td className="td-center">
                        <div className="row-actions">
                          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setModal({ open: true, mode: 'edit', editing: d })}>수정</button>
                          <button type="button" className="btn btn-danger btn-sm" onClick={() => remove(d.id)}>삭제</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* 자산 추가/수정 모달 */}
      <AssetModal
        state={modal}
        onClose={() => setModal((s) => ({ ...s, open: false }))}
        onSaved={() => { setModal((s) => ({ ...s, open: false })); bump(); }}
      />
    </AppShell>
  );
}

// 자산 추가·수정 모달
function AssetModal({ state, onClose, onSaved }: { state: { open: boolean; mode: 'add' | 'edit'; editing?: Asset }; onClose: () => void; onSaved: () => void }) {
  const e = state.editing;
  const [type, setType] = useState<AssetType>('cash');
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [interestRate, setInterestRate] = useState('');
  const [memo, setMemo] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // 모달 열릴 때 폼 초기화 (편집 시 기존 값, 추가 시 기본값)
  useEffect(() => {
    if (!state.open) return;
    setErr(null);
    setType(e?.type ?? 'cash');
    setName(e?.name ?? '');
    setAmount(e ? String(e.amount) : '');
    setInterestRate(e?.interestRate != null ? String(e.interestRate) : '');
    setMemo(e?.memo ?? '');
  }, [state.open, e]);

  async function save() {
    setSaving(true); setErr(null);
    try {
      const payload = {
        type, name, amount: Number(amount),
        interestRate: interestRate !== '' ? Number(interestRate) : undefined,
        memo: memo || undefined,
      };
      if (state.mode === 'edit' && e) await api.put(`/assets/${e.id}`, payload);
      else await api.post('/assets', payload);
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
      title={state.mode === 'edit' ? '자산 수정' : '자산 추가'}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>취소</button>
          <button type="button" className="btn btn-primary" onClick={save} disabled={saving}>{saving ? '저장 중...' : '저장'}</button>
        </>
      }
    >
      {err && <p className="input-error">⚠️ {err}</p>}
      <Field label="자산 유형">
        <select className="input" aria-label="자산 유형" value={type} onChange={(ev) => setType(ev.target.value as AssetType)}>
          {ASSET_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </Field>
      <Field label="자산명"><input type="text" className="input" placeholder="예: 신한 입출금 계좌" value={name} onChange={(ev) => setName(ev.target.value)} /></Field>
      <div className="form-grid-2">
        <Field label="금액 (원)"><input type="number" className="input" placeholder="0" value={amount} onChange={(ev) => setAmount(ev.target.value)} /></Field>
        <Field label="금리 (%, 선택)"><input type="number" className="input" placeholder="3.8" step="0.1" value={interestRate} onChange={(ev) => setInterestRate(ev.target.value)} /></Field>
      </div>
      <Field label="메모 (선택)"><input type="text" className="input" placeholder="기관/계좌 등" value={memo} onChange={(ev) => setMemo(ev.target.value)} /></Field>
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
