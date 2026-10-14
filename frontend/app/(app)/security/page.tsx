'use client';

/**
 * 보안 페이지.
 * 로그인 기기/세션 관리 + 보관함 잠금(자동 숨김 · 마스터 잠금) + 최근 열람 기록.
 * 데이터는 백엔드 API(/security)와 연동한다.
 */
import AppShell from '@/components/AppShell';
import PageHeader from '@/components/PageHeader';
import ErrorBanner from '@/components/ErrorBanner';
import EmptyState from '@/components/EmptyState';
import SecuritySettings, { SessionExpiryRow } from '@/components/SecuritySettings';
import StatCard, { StatStrip } from '@/components/StatCard';
import { useConfirm } from '@/components/ConfirmModal';
import { IconEye, IconLock, IconMonitor, IconUnlock } from '@/components/icons';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { api } from '@/lib/api';
import { notify } from '@/lib/toast';
import { useApiQuery, useInvalidate } from '@/lib/query';
import { qk } from '@/lib/queryKeys';
import { relativeTime } from '@/lib/notification';
import { DEVICE_ICON, ACCESS_ACTION_META, accessTargetLabel, accessIpLabel, type LoginSession, type AccessLogEntry, type VaultStatus } from '@/lib/security';

export default function SecurityPage() {
  const { confirm, confirmElement } = useConfirm();
  const invalidate = useInvalidate();

  const sessionsQuery = useApiQuery<LoginSession[]>(qk.security.sessions(), '/security/sessions');
  const logsQuery = useApiQuery<AccessLogEntry[]>(qk.security.accessLogs(10), '/security/access-logs?limit=10');
  const vaultQuery = useApiQuery<VaultStatus>(qk.security.vault(), '/security/vault');

  const sessions = sessionsQuery.data ?? [];
  const logs = logsQuery.data ?? [];
  const vault = vaultQuery.data;
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

      <StatStrip>
        <StatCard icon={<IconMonitor />} tone="amber" label="로그인 기기" value={sessionsQuery.data ? `${sessions.length}대` : '-'} />
        <StatCard
          icon={vault?.enabled ? <IconLock /> : <IconUnlock />}
          tone="amber"
          label="보관함 잠금"
          value={vault ? (vault.enabled ? '사용 중' : '미설정') : '-'}
          change="AES-256-GCM 암호화"
        />
        <StatCard
          icon={<IconEye />}
          tone="amber"
          label="최근 열람"
          value={logsQuery.data ? `${logs.length}건` : '-'}
          change={logs[0] ? `마지막 ${relativeTime(logs[0].at)}` : undefined}
        />
      </StatStrip>

      <div className="flex flex-col gap-6">
        {/* 로그인 기기 / 세션 */}
        <Card clip>
          <CardHeader>
            <CardTitle>로그인 기기 · 세션</CardTitle>
            <Button variant="danger" size="sm" onClick={handleRevokeAll}>전체 로그아웃</Button>
          </CardHeader>
          <div>
            {sessions.map((s) => {
              const DeviceIcon = DEVICE_ICON[s.deviceType];
              const unverified = s.status === 'unverified';
              return (
                <div className="flex items-center gap-3 px-4.5 py-2.5 border-b border-border-subtle max-md:min-h-11" key={s.id}>
                  <DeviceIcon width={18} height={18} className="shrink-0 text-muted" />
                  <div className="flex-1 min-w-0 flex flex-col leading-[1.4]">
                    <span className="flex items-center gap-2 flex-wrap text-[0.875rem] text-primary">
                      {s.device}
                      {s.isCurrent && <Badge tone="success">현재 기기</Badge>}
                      {!s.isCurrent && unverified && <Badge tone="warning">미확인</Badge>}
                    </span>
                    <span className="text-[0.78rem] text-muted">{accessIpLabel(s.location)} · {relativeTime(s.lastActiveAt)}</span>
                  </div>
                  {!s.isCurrent && (
                    <Button variant={unverified ? 'danger' : 'ghost'} size="sm" onClick={() => handleRevokeSession(s.id)}>
                      {unverified ? '차단' : '로그아웃'}
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
          <SessionExpiryRow />
        </Card>

        {/* 보관함 잠금 — 암호화 방식 · 비밀번호 자동 숨김 · 마스터 잠금 */}
        <SecuritySettings />

        {/* 최근 열람 (접근 감사 로그) */}
        <Card clip>
          <CardHeader>
            <CardTitle>최근 열람</CardTitle>
            <span className="text-[0.78rem] text-muted max-md:hidden">복호화할 때마다 한 줄씩 남습니다</span>
          </CardHeader>
          <div>
            {logs.length === 0 && <EmptyState size="sm" message="열람 기록이 없습니다." />}
            {logs.map((l) => {
              const meta = ACCESS_ACTION_META[l.action];
              const ActionIcon = meta?.Icon ?? IconUnlock;
              return (
                <div className="flex items-center gap-3 px-4.5 py-2.5 border-b border-border-subtle last:border-b-0 text-[0.84rem]" key={l.id}>
                  <ActionIcon width={16} height={16} className="shrink-0 text-muted" />
                  <span className="flex-1 min-w-0 truncate">
                    <span className="text-primary">{accessTargetLabel(l.action, l.targetName)}</span>
                    <span className="text-muted"> · {meta?.label ?? l.action}</span>
                  </span>
                  <span className="w-37.5 text-[0.78rem] text-muted truncate max-md:hidden">{l.ip ? accessIpLabel(l.ip) : ''}</span>
                  <span className="w-16 text-right text-[0.78rem] text-muted shrink-0">{relativeTime(l.at)}</span>
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
