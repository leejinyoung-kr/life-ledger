'use client';

/**
 * 보안 센터 페이지.
 * 보안 점수 게이지 + 위험 요소(재사용/취약/2FA미설정/유출)·로그인 세션을 점검·관리한다.
 * 데이터는 백엔드 API(/security)와 연동한다.
 */
import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import AppShell from '@/components/AppShell';
import { useConfirm } from '@/components/ConfirmModal';
import StatCard from '@/components/StatCard';
import { api } from '@/lib/api';
import { relativeTime } from '@/lib/notification';
import {
  RISK_CATEGORY_ICON, SEVERITY_BADGE, STAT_META, DEVICE_ICON, SCORE_COLOR,
  type SecuritySummary, type SecurityRisk, type LoginSession,
} from '@/lib/security';

export default function SecurityPage() {
  const [summary, setSummary] = useState<SecuritySummary | null>(null);
  const [risks, setRisks] = useState<SecurityRisk[]>([]);
  const [sessions, setSessions] = useState<LoginSession[]>([]);
  const [error, setError] = useState<string | null>(null);
  const { confirm, confirmElement } = useConfirm();

  // 요약/위험/세션 조회
  const load = useCallback(async () => {
    try {
      const [s, r, ses] = await Promise.all([
        api.get<SecuritySummary>('/security/summary'),
        api.get<SecurityRisk[]>('/security/risks'),
        api.get<LoginSession[]>('/security/sessions'),
      ]);
      setSummary(s); setRisks(r); setSessions(ses); setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // 위험 요소 해결
  async function resolveRisk(id: number) {
    try { await api.post(`/security/risks/${id}/resolve`, {}); load(); }
    catch (e) { setError((e as Error).message); }
  }

  // 단일 세션 로그아웃/차단
  async function revokeSession(id: number) {
    try { await api.post(`/security/sessions/${id}/revoke`, {}); load(); }
    catch (e) { setError((e as Error).message); }
  }

  // 전체 세션 로그아웃 (현재 기기 제외)
  async function revokeAll() {
    if (!await confirm('현재 기기를 제외한 모든 세션을 로그아웃할까요?', 'danger')) return;
    try { await api.post('/security/sessions/revoke-all', {}); load(); }
    catch (e) { setError((e as Error).message); }
  }

  const score = summary?.score ?? 0;
  const gaugeColor = summary ? SCORE_COLOR[summary.scoreLabel] ?? 'var(--warning)' : 'var(--warning)';

  return (
    <AppShell activePath="/security" topbarLabel="보안 센터">
      <div className="page-header">
        <h1 className="page-title">보안 센터</h1>
        <p className="page-subtitle">계정·시크릿의 보안 상태를 점검하고 위험 요소를 관리합니다.</p>
      </div>

      {error && <p className="ledger-note is-error">⚠️ {error}</p>}

      {summary && (
        <>
          {/* 보안 점수 게이지 */}
          <div className="sec-hero">
            <div className="gauge" style={{ background: `conic-gradient(${gaugeColor} 0 ${score}%, var(--bg-elevated) ${score}% 100%)` } as CSSProperties}>
              <div className="gauge-val">
                <div className="gauge-score">{score}</div>
                <div className="gauge-max">/ 100</div>
              </div>
            </div>
            <div className="sec-hero-main">
              <div className="sec-hero-title">보안 점수 — {summary.scoreLabel}</div>
              <p className="sec-hero-desc">
                아래 <strong>{summary.riskCount}건</strong>의 위험 요소를 해결하면 점수가 <strong className="hi">+{summary.gainIfResolved}</strong> 올라갑니다. 재사용 비밀번호와 2FA 미설정 계정을 우선 처리하세요.
              </p>
            </div>
          </div>

          {/* 요약 통계 */}
          <div className="grid-4 mb-8">
            {STAT_META.map((m) => (
              <StatCard key={m.key} icon={m.icon} tone={m.tone} value={String(summary.stats[m.key])} label={m.label} change={m.change} changeDir="neutral" />
            ))}
          </div>
        </>
      )}

      {/* 위험 요소 */}
      <div className="card mb-6">
        <div className="card-header">
          <span className="card-title">위험 요소</span>
          <span className="badge badge-warning">{risks.length}건</span>
        </div>
        <div className="card-list">
          {risks.length === 0 && <div className="risk-row"><div className="risk-main td-muted">해결할 위험 요소가 없습니다.</div></div>}
          {risks.map((r) => {
            const sev = SEVERITY_BADGE[r.severity];
            return (
              <div className="risk-row" key={r.id}>
                <div className={`risk-icon ${sev.tone}`}>{RISK_CATEGORY_ICON[r.category]}</div>
                <div className="risk-main">
                  <div className="risk-title">{r.title}</div>
                  <div className="risk-sub">{r.description}</div>
                </div>
                <span className={`badge ${sev.cls}`}>{sev.label}</span>
                <button type="button" className="btn btn-ghost" onClick={() => resolveRisk(r.id)}>{r.actionLabel}</button>
              </div>
            );
          })}
        </div>
      </div>

      {/* 로그인 기기 / 세션 */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">로그인 기기 / 세션</span>
          <button type="button" className="btn btn-danger" onClick={revokeAll}>전체 로그아웃</button>
        </div>
        <div className="card-list">
          {sessions.map((s) => {
            const tone = s.isCurrent ? 'green' : s.status === 'unverified' ? 'warning' : 'muted';
            const mark = s.isCurrent
              ? { text: '현재 기기', cls: 'badge-success' }
              : s.status === 'unverified'
                ? { text: '미확인', cls: 'badge-warning' }
                : null;
            return (
              <div className="sess-row" key={s.id}>
                <div className={`risk-icon ${tone}`}>{DEVICE_ICON[s.deviceType]}</div>
                <div className="risk-main">
                  <div className="risk-title">
                    {s.device}
                    {mark && <span className={`badge ${mark.cls} badge-inline`}>{mark.text}</span>}
                  </div>
                  <div className="risk-sub">{s.location} · {relativeTime(s.lastActiveAt)}</div>
                </div>
                {!s.isCurrent && (
                  <button type="button" className={`btn ${s.status === 'unverified' ? 'btn-danger' : 'btn-ghost'}`} onClick={() => revokeSession(s.id)}>
                    {s.status === 'unverified' ? '차단' : '로그아웃'}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
      {confirmElement}
    </AppShell>
  );
}
