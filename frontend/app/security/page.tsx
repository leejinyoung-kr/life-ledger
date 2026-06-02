'use client';

/**
 * 보안 센터 페이지.
 * 보안 점수 게이지 + 위험 요소(재사용/취약/2FA미설정/유출)·로그인 세션을 점검·관리한다.
 * 공통 레이아웃(AppShell)·통계카드(StatCard)를 재사용하고 데이터는 더미로 채운다.
 */
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import AppShell from '@/components/AppShell';
import StatCard from '@/components/StatCard';

type RiskTone = 'danger' | 'warning' | 'blue';
type SessTone = 'green' | 'muted' | 'warning';

// 보안 점수 (TODO: GET /api/v1/security/score)
const SCORE = 72;

// 상단 요약 통계 — TODO: GET /api/v1/security/summary
const STATS = [
  { tone: 'red'   as const, icon: '🔁', value: '3', label: '재사용 비밀번호', change: '위험',      changeDir: 'down' as const },
  { tone: 'amber' as const, icon: '⚠️', value: '2', label: '취약한 비밀번호', change: '8자 미만',  changeDir: 'neutral' as const },
  { tone: 'blue'  as const, icon: '🔐', value: '5', label: '2FA 미설정',      change: '권장',      changeDir: 'neutral' as const },
  { tone: 'red'   as const, icon: '🚨', value: '1', label: '유출 의심',        change: '즉시 변경', changeDir: 'down' as const },
];

// 위험 요소 — TODO: GET /api/v1/security/risks
const RISKS: { icon: string; tone: RiskTone; title: string; sub: string; badge: string; badgeClass: string; action: string; }[] = [
  { icon: '🚨', tone: 'danger',  title: '카카오뱅크 — 유출 의심 비밀번호', sub: '다크웹 유출 DB에서 동일 비밀번호 발견', badge: '심각', badgeClass: 'badge-danger', action: '변경' },
  { icon: '🔁', tone: 'danger',  title: 'GitHub · 쿠팡 · 넷플릭스 — 비밀번호 재사용', sub: '3개 계정이 같은 비밀번호 사용', badge: '위험', badgeClass: 'badge-danger', action: '분리' },
  { icon: '⚠️', tone: 'warning', title: '카카오뱅크 — 8자 미만 비밀번호', sub: 'bank1234! 강도 낮음', badge: '주의', badgeClass: 'badge-warning', action: '강화' },
  { icon: '🔐', tone: 'blue',    title: '쿠팡 외 4개 — 2FA 미설정', sub: '2단계 인증으로 계정 보호 강화', badge: '권장', badgeClass: 'badge-blue', action: '설정' },
];

// 로그인 세션 — TODO: GET /api/v1/security/sessions
const SESSIONS: { icon: string; tone: SessTone; name: string; mark?: { text: string; cls: string }; loc: string; action?: { label: string; danger?: boolean }; }[] = [
  { icon: '💻', tone: 'green',   name: 'MacBook Pro · Chrome', mark: { text: '현재 기기', cls: 'badge-success' }, loc: '서울 · 192.168.0.x · 방금 전' },
  { icon: '📱', tone: 'muted',   name: 'iPhone 15 · Safari', loc: '서울 · 3시간 전', action: { label: '로그아웃' } },
  { icon: '🖥️', tone: 'warning', name: 'Windows · Edge', mark: { text: '미확인', cls: 'badge-warning' }, loc: '부산 · 2일 전', action: { label: '차단', danger: true } },
];

export default function SecurityPage() {
  const router = useRouter();

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
    <AppShell activePath="/security" topbarLabel="보안 센터" onLogout={logout}>
      <div className="page-header">
        <h1 className="page-title">보안 센터</h1>
        <p className="page-subtitle">계정·시크릿의 보안 상태를 점검하고 위험 요소를 관리합니다.</p>
      </div>

      {/* 보안 점수 게이지 */}
      <div className="sec-hero">
        <div className="gauge" style={{ background: `conic-gradient(var(--warning) 0 ${SCORE}%, var(--bg-elevated) ${SCORE}% 100%)` }}>
          <div className="gauge-val">
            <div className="gauge-score">{SCORE}</div>
            <div className="gauge-max">/ 100</div>
          </div>
        </div>
        <div className="sec-hero-main">
          <div className="sec-hero-title">보안 점수 — 보통</div>
          <p className="sec-hero-desc">
            아래 <strong>11건</strong>의 위험 요소를 해결하면 점수가 <strong className="hi">+23</strong> 올라갑니다. 재사용 비밀번호와 2FA 미설정 계정을 우선 처리하세요.
          </p>
        </div>
      </div>

      {/* 요약 통계 */}
      <div className="grid-4 mb-8">
        {STATS.map((s) => (
          <StatCard key={s.label} icon={s.icon} tone={s.tone} value={s.value} label={s.label} change={s.change} changeDir={s.changeDir} />
        ))}
      </div>

      {/* 위험 요소 */}
      <div className="card mb-6">
        <div className="card-header">
          <span className="card-title">위험 요소</span>
          <span className="badge badge-warning">{RISKS.length}건</span>
        </div>
        <div className="card-list">
          {RISKS.map((r) => (
            <div className="risk-row" key={r.title}>
              <div className={`risk-icon ${r.tone}`}>{r.icon}</div>
              <div className="risk-main">
                <div className="risk-title">{r.title}</div>
                <div className="risk-sub">{r.sub}</div>
              </div>
              <span className={`badge ${r.badgeClass}`}>{r.badge}</span>
              {/* TODO: 위험 요소별 처리 액션 연동 */}
              <button type="button" className="btn btn-ghost">{r.action}</button>
            </div>
          ))}
        </div>
      </div>

      {/* 로그인 기기 / 세션 */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">로그인 기기 / 세션</span>
          {/* TODO: 전체 세션 로그아웃 API 연동 */}
          <button type="button" className="btn btn-danger">전체 로그아웃</button>
        </div>
        <div className="card-list">
          {SESSIONS.map((s) => (
            <div className="sess-row" key={s.name}>
              <div className={`risk-icon ${s.tone}`}>{s.icon}</div>
              <div className="risk-main">
                <div className="risk-title">
                  {s.name}
                  {s.mark && <span className={`badge ${s.mark.cls} badge-inline`}>{s.mark.text}</span>}
                </div>
                <div className="risk-sub">{s.loc}</div>
              </div>
              {/* TODO: 개별 세션 로그아웃/차단 API 연동 */}
              {s.action && (
                <button type="button" className={`btn ${s.action.danger ? 'btn-danger' : 'btn-ghost'}`}>{s.action.label}</button>
              )}
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
