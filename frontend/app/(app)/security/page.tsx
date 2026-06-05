'use client';

/**
 * 보안 센터 페이지.
 * 보안 점수 게이지 + 위험 요소(재사용/취약/2FA미설정/유출)·로그인 세션을 점검·관리한다.
 * 데이터는 백엔드 API(/security)와 연동한다.
 * 스타일: Tailwind + 공통 컴포넌트(StatCard/Button/Badge/Card). 게이지는 동적 conic-gradient inline.
 */
import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import AppShell from '@/components/AppShell';
import { useConfirm } from '@/components/ConfirmModal';
import StatCard from '@/components/StatCard';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { api } from '@/lib/api';
import { relativeTime } from '@/lib/notification';
import {
  RISK_CATEGORY_ICON, SEVERITY_BADGE, STAT_META, DEVICE_ICON, SCORE_COLOR,
  type SecuritySummary, type SecurityRisk, type LoginSession,
} from '@/lib/security';

// 위험/세션 아이콘 배경색 (tone → Tailwind)
const RISK_ICON_BG: Record<string, string> = {
  danger: 'bg-danger-dim', warning: 'bg-warning-dim', blue: 'bg-blue-dim', green: 'bg-accent-dim', muted: 'bg-elevated',
};

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
      <div className="mb-7">
        <h1 className="[font-family:var(--font-display)] text-[1.55rem] font-bold tracking-[-0.03em] text-primary">보안 센터</h1>
        <p className="text-sm text-secondary mt-1.5">계정·시크릿의 보안 상태를 점검하고 위험 요소를 관리합니다.</p>
      </div>

      {error && <p className="mt-3 mb-3 text-[0.78rem] text-danger">⚠️ {error}</p>}

      {summary && (
        <>
          {/* 보안 점수 게이지 */}
          <div className="flex gap-7 items-center flex-wrap px-7 py-6 bg-background border border-border rounded-[var(--radius-lg)] shadow-[var(--shadow-sm)] mb-6">
            <div
              className="w-[130px] h-[130px] rounded-full shrink-0 flex items-center justify-center relative after:content-[''] after:w-24 after:h-24 after:rounded-full after:bg-background after:absolute"
              style={{ background: `conic-gradient(${gaugeColor} 0 ${score}%, var(--bg-elevated) ${score}% 100%)` } as CSSProperties}
            >
              <div className="relative text-center">
                <div className="[font-family:var(--font-display)] text-[2rem] font-extrabold text-warning">{score}</div>
                <div className="text-[0.68rem] text-muted">/ 100</div>
              </div>
            </div>
            <div className="flex-1 min-w-[200px]">
              <div className="[font-family:var(--font-display)] text-[1.2rem] font-bold mb-1.5">보안 점수 — {summary.scoreLabel}</div>
              <p className="text-[0.855rem] text-secondary leading-relaxed [&_.hi]:text-accent">
                아래 <strong>{summary.riskCount}건</strong>의 위험 요소를 해결하면 점수가 <strong className="hi">+{summary.gainIfResolved}</strong> 올라갑니다. 재사용 비밀번호와 2FA 미설정 계정을 우선 처리하세요.
              </p>
            </div>
          </div>

          {/* 요약 통계 */}
          <div className="grid grid-cols-2 min-[1100px]:grid-cols-4 gap-4 mb-8">
            {STAT_META.map((m) => (
              <StatCard key={m.key} icon={m.icon} tone={m.tone} value={String(summary.stats[m.key])} label={m.label} change={m.change} changeDir="neutral" />
            ))}
          </div>
        </>
      )}

      {/* 위험 요소 */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>위험 요소</CardTitle>
          <Badge tone="warning">{risks.length}건</Badge>
        </CardHeader>
        <div>
          {risks.length === 0 && <div className="px-5 py-3.5 text-secondary">해결할 위험 요소가 없습니다.</div>}
          {risks.map((r) => {
            const sev = SEVERITY_BADGE[r.severity];
            return (
              <div className="flex items-center gap-3.5 px-5 py-3.5 border-b border-border-subtle last:border-b-0" key={r.id}>
                <div className={`w-9 h-9 rounded-[var(--radius)] flex items-center justify-center shrink-0 text-base ${RISK_ICON_BG[sev.tone]}`}>{RISK_CATEGORY_ICON[r.category]}</div>
                <div className="flex-1">
                  <div className="font-semibold text-[0.875rem]">{r.title}</div>
                  <div className="text-[0.78rem] text-muted">{r.description}</div>
                </div>
                <Badge tone={sev.tone as 'danger' | 'warning' | 'blue'}>{sev.label}</Badge>
                <Button href={r.href} variant="ghost" size="sm">{r.actionLabel}</Button>
              </div>
            );
          })}
        </div>
      </Card>

      {/* 로그인 기기 / 세션 */}
      <Card>
        <CardHeader>
          <CardTitle>로그인 기기 / 세션</CardTitle>
          <Button variant="danger" size="sm" onClick={revokeAll}>전체 로그아웃</Button>
        </CardHeader>
        <div>
          {sessions.map((s) => {
            const tone = s.isCurrent ? 'green' : s.status === 'unverified' ? 'warning' : 'muted';
            const mark = s.isCurrent
              ? { text: '현재 기기', tone: 'success' as const }
              : s.status === 'unverified'
                ? { text: '미확인', tone: 'warning' as const }
                : null;
            return (
              <div className="flex items-center gap-3.5 px-5 py-3.5 border-b border-border-subtle last:border-b-0" key={s.id}>
                <div className={`w-9 h-9 rounded-[var(--radius)] flex items-center justify-center shrink-0 text-base ${RISK_ICON_BG[tone]}`}>{DEVICE_ICON[s.deviceType]}</div>
                <div className="flex-1">
                  <div className="font-semibold text-[0.875rem] flex items-center gap-1.5">
                    {s.device}
                    {mark && <Badge tone={mark.tone}>{mark.text}</Badge>}
                  </div>
                  <div className="text-[0.78rem] text-muted">{s.location} · {relativeTime(s.lastActiveAt)}</div>
                </div>
                {!s.isCurrent && (
                  <Button variant={s.status === 'unverified' ? 'danger' : 'ghost'} size="sm" onClick={() => revokeSession(s.id)}>
                    {s.status === 'unverified' ? '차단' : '로그아웃'}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </Card>
      {confirmElement}
    </AppShell>
  );
}
