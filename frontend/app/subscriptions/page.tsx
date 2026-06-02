'use client';

/**
 * 구독 관리 페이지.
 * 정기 결제를 카드로 모아 결제 예정일·연 환산·미사용 의심 구독을 추적한다.
 * 공통 레이아웃(AppShell)·통계카드(StatCard)·모달(Modal)을 재사용하고 데이터는 더미로 채운다.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import AppShell from '@/components/AppShell';
import StatCard from '@/components/StatCard';
import Modal from '@/components/Modal';
import { IconRepeat, IconAlertTriangle } from '@/components/icons';

// ── 더미 데이터 (TODO: API 연동 시 교체) ─────────────────────────

// 상단 요약 통계 — TODO: GET /api/v1/subscriptions/summary
const STATS = [
  { tone: 'red'   as const, icon: <IconRepeat />, value: '₩84,500',    label: '월 구독료 합계', change: '▲ ₩17,000 신규',     changeDir: 'down' as const },
  { tone: 'amber' as const, icon: '📅',           value: '₩1,014,000', label: '연 환산 비용',   change: '= 12개월 기준',      changeDir: 'neutral' as const },
  { tone: 'blue'  as const, icon: '📦',           value: '7',          label: '활성 구독',      change: '+1 이번 달',         changeDir: 'up' as const },
  { tone: 'green' as const, icon: '⏰',           value: '3일',        label: '다음 결제까지',  change: '유튜브 프리미엄',     changeDir: 'neutral' as const },
];

type SubStatus = '활성' | '체험';
// 구독 목록 — TODO: GET /api/v1/subscriptions
const SUBS: {
  logo: string; name: string; cat: string; status: SubStatus;
  price: string; nextDate: string; dday: string; method: string;
}[] = [
  { logo: '📺', name: '넷플릭스',        cat: 'OTT · 엔터테인먼트', status: '활성', price: '₩17,000', nextDate: '2025.06.29', dday: 'D-27', method: '신한카드' },
  { logo: '▶️', name: '유튜브 프리미엄',  cat: 'OTT · 엔터테인먼트', status: '활성', price: '₩14,900', nextDate: '2025.06.04', dday: 'D-3',  method: '카카오페이' },
  { logo: '🎵', name: '스포티파이',      cat: '음악',              status: '활성', price: '₩10,900', nextDate: '2025.06.15', dday: 'D-14', method: '신한카드' },
  { logo: '📦', name: '쿠팡 와우',       cat: '쇼핑 멤버십',        status: '활성', price: '₩7,890',  nextDate: '2025.06.20', dday: 'D-19', method: '쿠페이' },
  { logo: '☁️', name: 'iCloud+ 200GB',  cat: '클라우드',          status: '활성', price: '₩3,300',  nextDate: '2025.06.10', dday: 'D-9',  method: '신한카드' },
  { logo: '🤖', name: 'ChatGPT Plus',   cat: 'AI · 생산성',        status: '활성', price: '$20',     nextDate: '2025.06.12', dday: 'D-11', method: '해외결제' },
  { logo: '🏰', name: 'Disney+',        cat: 'OTT · 엔터테인먼트', status: '체험', price: '₩9,900',  nextDate: '2025.06.04', dday: 'D-3',  method: '신한카드' },
];

// 미사용 의심 구독 — TODO: GET /api/v1/subscriptions/unused
const UNUSED = [
  { name: '🎵 스포티파이', cost: '₩10,900', lastUsed: '42일 전' },
  { name: '🏰 Disney+',    cost: '₩9,900',  lastUsed: '미사용 (체험)' },
];

export default function SubscriptionsPage() {
  const router = useRouter();
  // 구독 추가/수정 모달 상태
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
      activePath="/subscriptions"
      topbarLabel="구독 관리"
      actionLabel="구독 추가"
      onAction={() => setModal({ open: true, mode: 'add' })}
      onLogout={logout}
    >
      <div className="page-header">
        <h1 className="page-title">구독 관리</h1>
        <p className="page-subtitle">정기 결제를 한눈에 — 결제 예정일·연 환산·미사용 구독을 추적합니다.</p>
      </div>

      {/* 상단 요약 통계 */}
      <div className="grid-4 mb-8">
        {STATS.map((s) => (
          <StatCard key={s.label} icon={s.icon} tone={s.tone} value={s.value} label={s.label} change={s.change} changeDir={s.changeDir} />
        ))}
      </div>

      {/* 체험 종료 임박 경고 배너 */}
      <div className="alert-banner">
        <IconAlertTriangle width={20} height={20} />
        <div className="alert-body">
          <div className="alert-title">무료 체험 종료 임박 — Disney+</div>
          <div className="alert-desc">2025.06.04 부터 월 ₩9,900 자동 결제됩니다. 해지하려면 3일 남았습니다.</div>
        </div>
        {/* TODO: API 연동 — 구독 해지 처리 */}
        <button type="button" className="btn btn-ghost btn-sm">지금 해지</button>
      </div>

      {/* 구독 카드 그리드 */}
      <div className="sub-grid">
        {SUBS.map((sub) => (
          <div className="sub-card" key={sub.name}>
            <div className="sub-top">
              <div className="sub-logo">{sub.logo}</div>
              <div className="sub-head">
                <div className="sub-name">{sub.name}</div>
                <div className="sub-cat">{sub.cat}</div>
              </div>
              <span className={`badge ${sub.status === '체험' ? 'badge-warning' : 'badge-success'}`}>{sub.status}</span>
            </div>
            <div className="sub-price">{sub.price}<span className="sub-cycle">/월</span></div>
            <div className="sub-meta">
              <div className="sub-meta-row">
                <span className="l">다음 결제</span>
                <span>{sub.nextDate} <span className="sub-dday">{sub.dday}</span></span>
              </div>
              <div className="sub-meta-row"><span className="l">결제수단</span><span>{sub.method}</span></div>
            </div>
            <div className="sub-actions">
              <button type="button" className="btn btn-ghost grow" onClick={() => setModal({ open: true, mode: 'edit' })}>수정</button>
              {/* TODO: API 연동 — 구독 해지 처리 */}
              <button type="button" className="btn btn-danger">해지</button>
            </div>
          </div>
        ))}
      </div>

      {/* 미사용 의심 구독 */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">⚠️ 미사용 의심 구독</span>
          <span className="badge badge-warning">{UNUSED.length}건</span>
        </div>
        <div className="card-body">
          <p className="muted-note">최근 30일간 관련 활동(앱 실행/결제 외 사용)이 감지되지 않은 구독입니다.</p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>서비스</th><th>월 비용</th><th>마지막 사용 추정</th><th className="td-center">액션</th></tr>
              </thead>
              <tbody>
                {UNUSED.map((u) => (
                  <tr key={u.name}>
                    <td>{u.name}</td>
                    <td className="td-mono">{u.cost}</td>
                    <td className="td-muted">{u.lastUsed}</td>
                    <td className="td-center">
                      <button type="button" className="btn btn-danger btn-sm">해지 검토</button>
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
      />
    </AppShell>
  );
}

// 구독 추가·수정 모달
function SubscriptionModal({ state, onClose }: { state: { open: boolean; mode: 'add' | 'edit' }; onClose: () => void }) {
  return (
    <Modal
      open={state.open}
      onClose={onClose}
      title={state.mode === 'edit' ? '구독 수정' : '구독 추가'}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>취소</button>
          {/* TODO: API 연동 — 저장(POST/PUT) 처리 */}
          <button type="button" className="btn btn-primary">저장</button>
        </>
      }
    >
      <Field label="서비스명"><input type="text" className="input" placeholder="예: 넷플릭스" /></Field>
      <Field label="카테고리">
        <select className="input">
          <option>OTT · 엔터테인먼트</option><option>음악</option><option>클라우드</option>
          <option>쇼핑 멤버십</option><option>AI · 생산성</option><option>기타</option>
        </select>
      </Field>
      <div className="form-grid-2">
        <Field label="금액 (원)"><input type="number" className="input" placeholder="0" /></Field>
        <Field label="결제 주기">
          <select className="input"><option>매월</option><option>매년</option><option>매주</option></select>
        </Field>
      </div>
      <div className="form-grid-2">
        <Field label="다음 결제일"><input type="date" className="input" /></Field>
        <Field label="상태">
          <select className="input"><option>활성</option><option>체험</option><option>일시정지</option></select>
        </Field>
      </div>
      <Field label="결제수단">
        <select className="input"><option>신한카드</option><option>카카오페이</option><option>쿠페이</option><option>해외결제</option><option>계좌이체</option></select>
      </Field>
      <Field label="메모 (선택)"><input type="text" className="input" placeholder="간단한 메모" /></Field>
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
