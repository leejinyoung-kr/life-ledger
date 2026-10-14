'use client';

/**
 * 보안 페이지.
 * 로그인 기기/세션 관리 + 보안 설정(세션 만료 · 비밀번호 자동 숨김 · 마스터 잠금) + 최근 열람 기록.
 * 데이터는 백엔드 API(/security)와 연동한다.
 */
import AppShell from '@/components/AppShell';
import PageHeader from '@/components/PageHeader';
import ErrorBanner from '@/components/ErrorBanner';
import SecuritySettings from '@/components/SecuritySettings';
import { useConfirm } from '@/components/ConfirmModal';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { api } from '@/lib/api';
import { notify } from '@/lib/toast';
import { useApiQuery, useInvalidate } from '@/lib/query';
import { qk } from '@/lib/queryKeys';
import { relativeTime } from '@/lib/notification';
import { DEVICE_ICON, ACCESS_ACTION_META, accessTargetLabel, accessIpLabel, type LoginSession, type AccessLogEntry } from '@/lib/security';

// 세션 아이콘 배경색 (tone → Tailwind)
const SESSION_ICON_BG: Record<string, string> = {
  green: 'bg-accent-dim', warning: 'bg-warning-dim', muted: 'bg-elevated',
};

export default function SecurityPage() {
  const { confirm, confirmElement } = useConfirm();
  const invalidate = useInvalidate();

  const sessionsQuery = useApiQuery<LoginSession[]>(qk.security.sessions(), '/security/sessions');
  const logsQuery = useApiQuery<AccessLogEntry[]>(qk.security.accessLogs(10), '/security/access-logs?limit=10');

  const sessions = sessionsQuery.data ?? [];
  const logs = logsQuery.data ?? [];
  const error = (sessionsQuery.error ?? logsQuery.error)?.message ?? null;

  // 단일 세션 로그아웃/차단
  async function handleRevokeSession(id: number) {
    try { await api.post(`/security/sessions/${id}/revoke`, {}); invalidate(qk.security.all); }
    catch (e) { notify.error((e as Error).message); }
  }

  // 전체 세션 로그아웃 (현재 기기 제외)
  async function handleRevokeAll() {
    if (!await confirm('현재 기기를 제외한 모든 세션을 로그아웃할까요?', 'danger')) return;
    try { await api.post('/security/sessions/revoke-all', {}); invalidate(qk.security.all); }
    catch (e) { notify.error((e as Error).message); }
  }

  return (
    <AppShell activePath="/security">
      <PageHeader title="보안" description="로그인 기기와 보관함 잠금을 관리하고 최근 열람 기록을 확인합니다." />

      <ErrorBanner message={error} />

      <div className="flex flex-col gap-6">
        {/* 로그인 기기 / 세션 */}
        <Card>
          <CardHeader>
            <CardTitle>로그인 기기 / 세션</CardTitle>
            <Button variant="danger" size="sm" onClick={handleRevokeAll}>전체 로그아웃</Button>
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
                  <div className={`w-9 h-9 rounded-ui flex items-center justify-center shrink-0 text-base ${SESSION_ICON_BG[tone]}`}>{DEVICE_ICON[s.deviceType]}</div>
                  <div className="flex-1">
                    <div className="font-semibold text-[0.875rem] flex items-center gap-1.5">
                      {s.device}
                      {mark && <Badge tone={mark.tone}>{mark.text}</Badge>}
                    </div>
                    <div className="text-[0.78rem] text-muted">{s.location} · {relativeTime(s.lastActiveAt)}</div>
                  </div>
                  {!s.isCurrent && (
                    <Button variant={s.status === 'unverified' ? 'danger' : 'ghost'} size="sm" onClick={() => handleRevokeSession(s.id)}>
                      {s.status === 'unverified' ? '차단' : '로그아웃'}
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </Card>

        {/* 보안 설정 — 세션 만료 · 비밀번호 자동 숨김 · 마스터 잠금 */}
        <SecuritySettings />

        {/* 최근 열람 (접근 감사 로그) */}
        <Card>
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
                  <div className="w-9 h-9 rounded-ui flex items-center justify-center shrink-0 text-base bg-elevated">{meta?.icon ?? '🔓'}</div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-[0.85rem] truncate">{accessTargetLabel(l.action, l.targetName)}</div>
                    <div className="text-[0.76rem] text-muted">{meta?.label ?? l.action}{l.ip ? ` · ${accessIpLabel(l.ip)}` : ''}</div>
                  </div>
                  <div className="text-[0.74rem] text-muted shrink-0">{relativeTime(l.at)}</div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
      {confirmElement}
    </AppShell>
  );
}
