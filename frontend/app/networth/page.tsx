'use client';

/**
 * 자산 종합 페이지.
 * 순자산(자산 − 부채)을 도넛 구성·6개월 추이·부채 내역으로 추적한다.
 * 공통 레이아웃(AppShell)·통계카드(StatCard)·모달(Modal)을 재사용하고 데이터는 더미로 채운다.
 */
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import AppShell from '@/components/AppShell';
import StatCard from '@/components/StatCard';
import Modal from '@/components/Modal';

// ── 더미 데이터 (TODO: API 연동 시 교체) ─────────────────────────

// 자산 구성(도넛/범례) — TODO: GET /api/v1/networth/allocation
const ALLOCATION = [
  { label: '투자', amount: '₩63.8M', percent: 38, color: 'var(--accent)' },
  { label: '부동산', amount: '₩40.3M', percent: 24, color: 'var(--blue)' },
  { label: '예적금', amount: '₩37.0M', percent: 22, color: 'var(--amber)' },
  { label: '현금', amount: '₩26.9M', percent: 16, color: 'var(--text-muted)' },
];

// 자산 유형별 통계 — TODO: GET /api/v1/networth/by-type
const STATS = [
  { tone: 'green' as const, icon: '💵', value: '₩26.9M', label: '현금성 자산',        change: '입출금 3계좌', changeDir: 'neutral' as const },
  { tone: 'blue'  as const, icon: '🏦', value: '₩37.0M', label: '예적금',            change: '평균 3.8%',    changeDir: 'up' as const },
  { tone: 'amber' as const, icon: '📈', value: '₩63.8M', label: '투자',              change: '+11.7%',       changeDir: 'up' as const },
  { tone: 'red'   as const, icon: '🏠', value: '₩40.3M', label: '부동산(전세보증금)', change: '= 변동없음',   changeDir: 'neutral' as const },
];

// 순자산 6개월 추이 — TODO: GET /api/v1/networth/trend
const TREND = [
  { month: '1월', label: '132M', height: 70 },
  { month: '2월', label: '135M', height: 74 },
  { month: '3월', label: '134M', height: 72 },
  { month: '4월', label: '139M', height: 82 },
  { month: '5월', label: '140M', height: 88 },
  { month: '6월', label: '143M', height: 100, current: true },
];

// 부채 내역 — TODO: GET /api/v1/networth/debts
const DEBTS = [
  { name: '전세자금대출', balance: '₩20,000,000', rate: '3.2%', monthly: '₩53,000' },
  { name: '신용카드 할부', balance: '₩3,400,000', rate: '0%', monthly: '₩340,000' },
  { name: '학자금대출', balance: '₩1,600,000', rate: '2.1%', monthly: '₩45,000' },
];

// 자산 구성 배열로 도넛 conic-gradient 문자열 생성 (누적 percent 기준)
function buildDonutGradient(items: typeof ALLOCATION) {
  let acc = 0;
  const stops = items.map((it) => {
    const seg = `${it.color} ${acc}% ${acc + it.percent}%`;
    acc += it.percent;
    return seg;
  });
  return `conic-gradient(${stops.join(', ')})`;
}

export default function NetworthPage() {
  const router = useRouter();
  // 자산 추가/수정 모달 상태
  const [modal, setModal] = useState<{ open: boolean; mode: 'add' | 'edit' }>({ open: false, mode: 'add' });

  // 인증 가드 — 토큰 없으면 로그인 페이지로. TODO: 토큰 유효성 검증 API 연동
  useEffect(() => {
    if (!localStorage.getItem('auth_token')) {
      router.replace('/login');
    }
  }, [router]);

  // 로그아웃 — 토큰 제거 후 로그인 페이지로 이동
  function logout() {
    localStorage.removeItem('auth_token');
    router.push('/login');
  }

  return (
    <AppShell
      activePath="/networth"
      topbarLabel="자산 종합"
      actionLabel="자산 추가"
      onAction={() => setModal({ open: true, mode: 'add' })}
      onLogout={logout}
    >
      <div className="page-header">
        <h1 className="page-title">자산 종합</h1>
        <p className="page-subtitle">순자산 = 자산 − 부채. 현금·예적금·투자·부동산을 합산해 추적합니다.</p>
      </div>

      {/* 히어로 — 총 순자산 + 도넛 + 범례 */}
      <div className="nw-hero">
        <div className="nw-hero-main">
          <div className="nw-hero-label">총 순자산</div>
          <div className="nw-hero-value">₩142,847,000</div>
          <div className="nw-hero-change">▲ ₩3,420,000 (2.4%) 지난달 대비</div>
        </div>
        <div className="donut" style={{ background: buildDonutGradient(ALLOCATION) }}>
          <div className="donut-label">
            <div className="t">자산</div>
            <div className="v">₩168M</div>
          </div>
        </div>
        <div className="legend">
          {ALLOCATION.map((a) => (
            <div className="legend-row" key={a.label}>
              <span className="legend-dot" style={{ background: a.color }} />
              {a.label} {a.amount} ({a.percent}%)
            </div>
          ))}
        </div>
      </div>

      {/* 자산 유형별 통계 */}
      <div className="grid-4 mb-8">
        {STATS.map((s) => (
          <StatCard key={s.label} icon={s.icon} tone={s.tone} value={s.value} label={s.label} change={s.change} changeDir={s.changeDir} />
        ))}
      </div>

      {/* 추이 막대 + 부채 테이블 */}
      <div className="grid-2 mb-6">
        <div className="card">
          <div className="card-header"><span className="card-title">순자산 추이 (6개월)</span></div>
          <div className="card-body">
            <div className="bars">
              {TREND.map((t) => (
                <div
                  key={t.month}
                  className={`bar${t.current ? ' current' : ''}`}
                  style={{ height: `${t.height}%` } as CSSProperties}
                >
                  <span>{t.label}</span>
                  <small>{t.month}</small>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title">부채</span>
            <span className="badge badge-danger">₩25.0M</span>
          </div>
          <div className="card-body flush">
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>항목</th><th className="td-right">잔액</th>
                    <th className="td-right">금리</th><th className="td-right">월 상환</th>
                  </tr>
                </thead>
                <tbody>
                  {DEBTS.map((d) => (
                    <tr key={d.name}>
                      <td className="td-name">{d.name}</td>
                      <td className="td-mono td-right">{d.balance}</td>
                      <td className="td-right">{d.rate}</td>
                      <td className="td-mono td-right">{d.monthly}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* 자산 추가/수정 모달 */}
      <AssetModal state={modal} onClose={() => setModal((s) => ({ ...s, open: false }))} />
    </AppShell>
  );
}

// 자산 추가·수정 모달
function AssetModal({ state, onClose }: { state: { open: boolean; mode: 'add' | 'edit' }; onClose: () => void }) {
  return (
    <Modal
      open={state.open}
      onClose={onClose}
      title={state.mode === 'edit' ? '자산 수정' : '자산 추가'}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>취소</button>
          {/* TODO: API 연동 — 저장(POST/PUT) 처리 */}
          <button type="button" className="btn btn-primary">저장</button>
        </>
      }
    >
      <Field label="자산 유형">
        <select className="input" aria-label="자산 유형">
          <option>현금성 자산</option><option>예적금</option><option>투자</option>
          <option>부동산</option><option>부채</option><option>기타</option>
        </select>
      </Field>
      <Field label="자산명"><input type="text" className="input" placeholder="예: 신한 입출금 계좌" /></Field>
      <div className="form-grid-2">
        <Field label="금액 (원)"><input type="number" className="input" placeholder="0" /></Field>
        <Field label="금리 (%, 선택)"><input type="number" className="input" placeholder="3.8" step="0.1" /></Field>
      </div>
      <Field label="메모 (선택)"><input type="text" className="input" placeholder="기관/계좌 등" /></Field>
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
