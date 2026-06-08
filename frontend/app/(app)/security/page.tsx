'use client';

/**
 * 보안 센터 페이지.
 * 보안 점수 게이지 + 위험 요소(재사용/취약/2FA미설정/유출)·로그인 세션을 점검·관리한다.
 * 데이터는 백엔드 API(/security)와 연동한다.
 * 스타일: Tailwind + 공통 컴포넌트(StatCard/Button/Badge/Card). 게이지는 동적 conic-gradient inline.
 */
import { useState, type CSSProperties } from 'react';
import AppShell from '@/components/AppShell';
import { useConfirm } from '@/components/ConfirmModal';
import StatCard from '@/components/StatCard';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { api } from '@/lib/api';
import { notify } from '@/lib/toast';
import { useApiQuery, useInvalidate } from '@/lib/query';
import { qk } from '@/lib/queryKeys';
import { clearVaultToken } from '@/lib/vault';
import { relativeTime } from '@/lib/notification';
import {
  RISK_CATEGORY_ICON, SEVERITY_BADGE, STAT_META, DEVICE_ICON, SCORE_COLOR, ACCESS_ACTION_META,
  type SecuritySummary, type SecurityRisk, type LoginSession,
  type ScoreTrendPoint, type AccessLogEntry, type VaultStatus, type StrengthStats, type BreachResult,
} from '@/lib/security';

// 위험/세션 아이콘 배경색 (tone → Tailwind)
const RISK_ICON_BG: Record<string, string> = {
  danger: 'bg-danger-dim', warning: 'bg-warning-dim', blue: 'bg-blue-dim', green: 'bg-accent-dim', muted: 'bg-elevated',
};

export default function SecurityPage() {
  const { confirm, confirmElement } = useConfirm();
  const invalidate = useInvalidate();

  // 보안 데이터 (React Query 캐시)
  const summaryQuery = useApiQuery<SecuritySummary>(qk.security.summary(), '/security/summary');
  const risksQuery = useApiQuery<SecurityRisk[]>(qk.security.risks(), '/security/risks');
  const sessionsQuery = useApiQuery<LoginSession[]>(qk.security.sessions(), '/security/sessions');
  const trendQuery = useApiQuery<ScoreTrendPoint[]>(qk.security.scoreTrend(30), '/security/score-trend?days=30');
  const logsQuery = useApiQuery<AccessLogEntry[]>(qk.security.accessLogs(20), '/security/access-logs?limit=20');
  const vaultQuery = useApiQuery<VaultStatus>(qk.security.vault(), '/security/vault');
  const strengthQuery = useApiQuery<StrengthStats>(qk.security.strengthStats(), '/security/strength-stats');

  // 유출 검사 — 외부 API 호출이라 버튼으로 온디맨드 실행
  const [runBreach, setRunBreach] = useState(false);
  const breachQuery = useApiQuery<BreachResult>(qk.security.breach(), '/security/breach-check', { enabled: runBreach, staleTime: 5 * 60_000 });

  const summary = summaryQuery.data ?? null;
  const risks = risksQuery.data ?? [];
  const sessions = sessionsQuery.data ?? [];
  const trend = trendQuery.data ?? [];
  const logs = logsQuery.data ?? [];
  const vault = vaultQuery.data ?? null;
  const strength = strengthQuery.data ?? null;
  const error = (summaryQuery.error ?? sessionsQuery.error)?.message ?? null;

  // 보관함 즉시 잠그기 (vault 토큰 폐기)
  function lockNow() {
    clearVaultToken();
  }

  // 단일 세션 로그아웃/차단
  async function revokeSession(id: number) {
    try { await api.post(`/security/sessions/${id}/revoke`, {}); invalidate(qk.security.all); }
    catch (e) { notify.error((e as Error).message); }
  }

  // 전체 세션 로그아웃 (현재 기기 제외)
  async function revokeAll() {
    if (!await confirm('현재 기기를 제외한 모든 세션을 로그아웃할까요?', 'danger')) return;
    try { await api.post('/security/sessions/revoke-all', {}); invalidate(qk.security.all); }
    catch (e) { notify.error((e as Error).message); }
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

      {/* 마스터 잠금 + 보안 점수 추이 */}
      <div className="grid gap-4 mb-6 min-[900px]:grid-cols-2">
        {/* 마스터 잠금 상태 */}
        <Card>
          <CardHeader>
            <CardTitle>보관함 마스터 잠금</CardTitle>
            <Badge tone={vault?.enabled ? 'success' : 'warning'}>{vault?.enabled ? '사용 중' : '미설정'}</Badge>
          </CardHeader>
          <div className="px-5 py-4 flex items-center gap-3.5">
            <div className="w-9 h-9 rounded-[var(--radius)] flex items-center justify-center shrink-0 text-base bg-accent-dim">{vault?.enabled ? '🔒' : '🔓'}</div>
            <div className="flex-1">
              <div className="text-[0.82rem] text-secondary leading-relaxed [word-break:keep-all]">
                {vault?.enabled
                  ? `비밀번호·신원번호·ENV 값 열람 시 마스터 비밀번호가 필요합니다. 자동잠금 ${vault.timeoutMin > 0 ? `${vault.timeoutMin}분` : '수동'}.`
                  : 'Google 로그인만으로 모든 민감정보가 열람됩니다. 마스터 잠금으로 2차 보호를 권장합니다.'}
              </div>
            </div>
            {vault?.enabled
              ? <Button variant="ghost" size="sm" onClick={lockNow}>지금 잠그기</Button>
              : <Button href="/settings" variant="ghost" size="sm">설정</Button>}
          </div>
        </Card>

        {/* 보안 점수 추이 */}
        <Card>
          <CardHeader>
            <CardTitle>보안 점수 추이</CardTitle>
            <Badge tone="blue">최근 {trend.length}일</Badge>
          </CardHeader>
          <div className="px-5 py-4">
            {trend.length === 0 ? (
              <div className="text-[0.82rem] text-muted py-3">아직 기록이 없습니다. 매일 점수가 1건씩 쌓입니다.</div>
            ) : (
              <div className="flex items-end gap-1 h-[90px]">
                {trend.map((p) => (
                  <div
                    key={p.date}
                    title={`${p.date} · ${p.score}점`}
                    className="flex-1 rounded-t-[3px] bg-accent/70 hover:bg-accent transition-colors min-h-[2px]"
                    style={{ height: `${Math.max(p.score, 2)}%` }}
                  />
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>

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

      {/* 비밀번호 강도 분포 */}
      {strength && strength.total > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>비밀번호 강도 분포</CardTitle>
            <Badge tone="blue">평균 {strength.avgScorePct}%</Badge>
          </CardHeader>
          <div className="px-5 py-4">
            {/* 누적 막대 */}
            <div className="flex h-3 rounded-full overflow-hidden bg-elevated mb-3">
              {strength.strong > 0 && <div className="bg-accent" style={{ width: `${(strength.strong / strength.total) * 100}%` }} />}
              {strength.medium > 0 && <div className="bg-warning" style={{ width: `${(strength.medium / strength.total) * 100}%` }} />}
              {strength.weak > 0 && <div className="bg-danger" style={{ width: `${(strength.weak / strength.total) * 100}%` }} />}
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
              {([['강함', strength.strong, 'text-accent'], ['보통', strength.medium, 'text-warning'], ['취약', strength.weak, 'text-danger']] as const).map(([label, n, cls]) => (
                <div key={label}>
                  <div className={`text-[1.3rem] font-extrabold ${cls}`}>{n}</div>
                  <div className="text-[0.74rem] text-muted">{label}</div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* 유출 비밀번호 검사 (HIBP) */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>유출 비밀번호 검사</CardTitle>
          {breachQuery.data
            ? <Badge tone={breachQuery.data.breachedCount > 0 ? 'danger' : 'success'}>{breachQuery.data.breachedCount > 0 ? `${breachQuery.data.breachedCount}건 유출` : '안전'}</Badge>
            : <Badge tone="blue">HaveIBeenPwned</Badge>}
        </CardHeader>
        <div className="px-5 py-4">
          {!runBreach ? (
            <div className="flex items-center gap-3.5">
              <div className="w-9 h-9 rounded-[var(--radius)] flex items-center justify-center shrink-0 text-base bg-elevated">🛡️</div>
              <div className="flex-1 text-[0.82rem] text-secondary leading-relaxed [word-break:keep-all]">
                저장된 비밀번호가 외부 유출 DB에 있는지 검사합니다. 비밀번호 원문·전체 해시는 전송되지 않습니다(k-익명성).
              </div>
              <Button variant="ghost" size="sm" onClick={() => setRunBreach(true)}>검사 실행</Button>
            </div>
          ) : breachQuery.isFetching ? (
            <div className="text-[0.82rem] text-muted py-2">검사 중... (외부 DB 대조)</div>
          ) : breachQuery.data ? (
            breachQuery.data.breachedCount === 0 ? (
              <div className="text-[0.82rem] text-accent py-1">✓ 검사한 {breachQuery.data.checked}건 모두 유출 이력이 없습니다.</div>
            ) : (
              <div>
                {breachQuery.data.items.map((b) => (
                  <div className="flex items-center gap-3.5 px-0 py-2.5 border-b border-border-subtle last:border-b-0" key={b.credentialId}>
                    <div className="w-9 h-9 rounded-[var(--radius)] flex items-center justify-center shrink-0 text-base bg-danger-dim">🚨</div>
                    <div className="flex-1">
                      <div className="font-semibold text-[0.85rem]">{b.name}</div>
                      <div className="text-[0.76rem] text-muted">유출 DB에서 {b.count.toLocaleString()}회 발견 — 즉시 변경 권장</div>
                    </div>
                    <Button href={`/credentials?focus=${b.credentialId}`} variant="ghost" size="sm">변경</Button>
                  </div>
                ))}
              </div>
            )
          ) : (
            <div className="text-[0.82rem] text-danger py-2">검사에 실패했습니다. 잠시 후 다시 시도하세요.</div>
          )}
        </div>
      </Card>

      {/* 최근 열람 (접근 감사 로그) */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>최근 열람</CardTitle>
          <Badge tone="blue">{logs.length}건</Badge>
        </CardHeader>
        <div>
          {logs.length === 0 && <div className="px-5 py-3.5 text-secondary">열람 기록이 없습니다.</div>}
          {logs.map((l) => {
            const meta = ACCESS_ACTION_META[l.action];
            return (
              <div className="flex items-center gap-3.5 px-5 py-3 border-b border-border-subtle last:border-b-0" key={l.id}>
                <div className="w-9 h-9 rounded-[var(--radius)] flex items-center justify-center shrink-0 text-base bg-elevated">{meta?.icon ?? '🔓'}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-[0.85rem] truncate">{l.targetName}</div>
                  <div className="text-[0.76rem] text-muted">{meta?.label ?? l.action}{l.ip ? ` · ${l.ip}` : ''}</div>
                </div>
                <div className="text-[0.74rem] text-muted shrink-0">{relativeTime(l.at)}</div>
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
