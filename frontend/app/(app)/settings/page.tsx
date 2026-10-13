'use client';

/**
 * 설정 페이지.
 * 좌측 탭(프로필/데이터)으로 분기한다. 데이터는 백엔드 API(/settings)와 연동한다.
 * 스타일: Tailwind + 공통 컴포넌트(Button/Badge/Toggle).
 */
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { notify } from '@/lib/toast';
import { eulreul } from '@/lib/korean';
import { useApiQuery } from '@/lib/query';
import { qk } from '@/lib/queryKeys';
import AppShell from '@/components/AppShell';
import PageHeader from '@/components/PageHeader';
import Tabs from '@/components/ui/Tabs';
import ErrorBanner from '@/components/ErrorBanner';
import QueryError from '@/components/QueryError';
import { PageLoading } from '@/components/QueryState';
import { useConfirm } from '@/components/ConfirmModal';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Toggle from '@/components/ui/Toggle';
import { api, apiDownload, setAccessToken } from '@/lib/api';
import { isPushSupported, fetchPushStatus, getCurrentSubscription, enablePush, disablePush, sendTestPush } from '@/lib/push';
import type { Settings } from '@/lib/settings';
import { SettingGroup, SettingRow } from '@/components/SettingGroup';
import { useSettingsPatch } from '@/lib/useSettingsPatch';

type TabId = 'profile' | 'data';
const TABS: { id: TabId; label: string }[] = [
  { id: 'profile', label: '프로필' },
  { id: 'data', label: '데이터' },
];

export default function SettingsPage() {
  const router = useRouter();
  const { confirm, confirmElement } = useConfirm();
  const [tab, setTab] = useState<TabId>('profile');
  const settingsQuery = useApiQuery<Settings>(qk.settings.detail(), '/settings');
  const s = settingsQuery.data ?? null;
  const error = settingsQuery.error?.message ?? null;

  // 계정 보관함 JSON 백업 복원 (export 역방향) — 같은 계정 + 백업에 쓰인 암호화 키가 서버에 남아 있어야 복원된다
  async function handleImportCredentials(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!await confirm('계정 백업 JSON 을 현재 보관함에 추가할까요? (덮어쓰지 않고 추가됩니다)', 'primary')) return;
    try {
      const r = await api.upload<{ imported: number; skipped: number; errors: string[] }>('/import/credentials', file);
      if (r.errors.length) notify.error(`${r.imported}건 복원 · ${r.skipped}건 건너뜀 (형식 오류 포함)`);
      else if (r.skipped) notify.success(`${r.imported}건 복원, ${r.skipped}건 건너뜀`);
      else notify.success(`계정 ${r.imported}건을 복원했습니다.`);
    } catch (err) {
      notify.error((err as Error).message);
    }
  }

  // 데이터 내보내기 — 인증 첨부 후 파일 다운로드
  async function exportData(path: string, filename: string) {
    try {
      await apiDownload(path, filename);
      notify.downloaded();
    } catch {
      notify.error('내보내기에 실패했습니다.');
    }
  }

  // 계정 영구 삭제 — 확인 후 전 데이터 제거 + 로그아웃
  async function handleDeleteAccount() {
    if (!await confirm('계정을 영구 삭제할까요? 모든 데이터가 사라지며 되돌릴 수 없습니다.', 'danger')) return;
    try {
      await api.del('/auth/me');
      setAccessToken(null);
      notify.success('계정이 삭제됐습니다.');
      router.push('/login');
    } catch {
      notify.error('계정 삭제에 실패했습니다.');
    }
  }

  // 로컬 편집 상태 (입력 중 값 — 저장 버튼으로 커밋)
  const [displayName, setDisplayName] = useState('');

  // 웹 푸시 — 브라우저/권한 기반(설정 DTO 아님). serverReady=서버 VAPID 활성, on=현재 구독중
  const [pushSupported, setPushSupported] = useState(false);
  const [pushServerReady, setPushServerReady] = useState(false);
  const [pushOn, setPushOn] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);

  // 마운트 시 푸시 지원/서버활성/구독상태 조회
  useEffect(() => {
    if (!isPushSupported()) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 마운트 시 푸시 지원 여부 동기화
    setPushSupported(true);
    (async () => {
      const status = await fetchPushStatus();
      setPushServerReady(status.enabled);
      const sub = await getCurrentSubscription();
      setPushOn(!!sub);
    })();
  }, []);

  // 푸시 토글 — 켜기(권한+구독+서버저장) / 끄기(구독취소+서버삭제)
  async function handleTogglePush() {
    if (pushBusy) return;
    setPushBusy(true);
    try {
      if (pushOn) {
        await disablePush();
        setPushOn(false);
        notify.success('푸시 알림을 껐습니다.');
      } else {
        await enablePush();
        setPushOn(true);
        notify.success('푸시 알림을 켰습니다.');
      }
    } catch (e) {
      notify.error((e as Error).message);
    } finally {
      setPushBusy(false);
    }
  }

  // 테스트 푸시 — 본인 기기로 더미 알림 발송. 구독 없거나 서버 비활성이면 안내
  async function handleTestPush() {
    if (pushBusy) return;
    setPushBusy(true);
    try {
      const res = await sendTestPush();
      if (!res.enabled) notify.error('서버에 푸시 키(VAPID)가 설정되지 않았습니다.');
      else if (res.subscriptions === 0) notify.error('구독된 기기가 없습니다. 먼저 푸시를 켜세요.');
      else notify.success(`테스트 푸시를 발송했습니다. (${res.subscriptions}개 기기)`);
    } catch (e) {
      notify.error((e as Error).message);
    } finally {
      setPushBusy(false);
    }
  }

  // 설정 로드 시 로컬 편집 상태 동기화 (입력 중 값은 저장 버튼으로 커밋)
  useEffect(() => {
    const data = settingsQuery.data;
    if (!data) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 설정 데이터 로드 시 편집 상태 동기화
    setDisplayName(data.displayName);
  }, [settingsQuery.data]);

  // 부분 저장 — 변경 필드만 PUT, 응답으로 서버 상태 동기화
  const patch = useSettingsPatch();

  if (!s) {
    return (
      <AppShell activePath="/settings" topbarLabel="설정">
        <PageHeader title="설정" />
        {settingsQuery.isError
          ? <QueryError message={error ?? undefined} onRetry={settingsQuery.refetch} />
          : <PageLoading size="sm" />}
      </AppShell>
    );
  }

  const NOTIF_LABEL: Record<string, string> = {
    notifUpload: '파일 업로드 완료 알림',
    notifMaturity: '만기·결제 임박 알림',
  };

  // 알림 토글 — 즉시 저장
  const handleToggleNotif = (key: 'notifUpload' | 'notifMaturity') => {
    const next = !s[key];
    const label = NOTIF_LABEL[key];
    patch({ [key]: next }, `${label}${eulreul(label)} ${next ? '켰습니다.' : '껐습니다.'}`);
  };

  return (
    <AppShell activePath="/settings" topbarLabel="설정">
      <PageHeader title="설정" description="계정, 알림, 데이터 백업 등을 관리합니다." />

      <ErrorBanner message={error} />

      <div className="grid grid-cols-[192px_1fr] gap-7 items-start max-md:grid-cols-1">
        {/* 탭 네비 */}
        <div className="relative max-md:static">
          <Tabs
            label="설정"
            variant="vertical"
            className="sticky top-[calc(var(--header-h)+28px)] max-md:static"
            value={tab}
            onChange={setTab}
            items={TABS.map((t) => ({ value: t.id, label: t.label }))}
          />
          <div className="hidden max-md:block absolute top-0 right-0 bottom-0 w-6 rounded-r-lg bg-linear-to-l from-background to-transparent pointer-events-none" />
        </div>

        <div className="flex flex-col gap-4">
          {/* ── 프로필 ── */}
          {tab === 'profile' && (
            <>
              <SettingGroup title="내 계정">
                <div className="flex items-center gap-5 p-5">
                  <div className="w-15 h-15 rounded-full bg-accent-dim border-2 border-accent flex items-center justify-center [font-family:var(--font-display)] text-[1.4rem] font-extrabold text-accent shrink-0">{(s.displayName || s.user.name || '?').charAt(0)}</div>
                  <div>
                    <div className="font-semibold text-primary text-[0.95rem]">{s.displayName}</div>
                    <div className="text-[0.82rem] text-muted mt-0.5">{s.user.email}</div>
                    <div className="mt-2.5"><Badge tone="success">Google 연결됨</Badge></div>
                  </div>
                </div>
                <div className="flex flex-col gap-2.5 px-5 py-3.5 border-b border-border-subtle last:border-b-0 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
                  <div className="min-w-0">
                    <div className="text-[0.875rem] font-medium text-primary">표시 이름</div>
                    <div className="text-[0.78rem] text-muted mt-0.5">대시보드 상단에 표시되는 이름</div>
                  </div>
                  <div className="flex items-center gap-2.5 sm:shrink-0">
                    <input type="text" className="input flex-1 min-w-0 sm:w-45 sm:flex-none" value={displayName} onChange={(e) => setDisplayName(e.target.value)} aria-label="표시 이름" />
                    <Button onClick={() => patch({ displayName })}>저장</Button>
                  </div>
                </div>
              </SettingGroup>
              <SettingGroup title="알림">
                {pushSupported && (
                  <SettingRow
                    label="푸시 알림 (이 기기)"
                    desc={
                      pushServerReady
                        ? '브라우저를 닫아도 만기·결제·보안 알림을 푸시로 받습니다.'
                        : '서버에 푸시 키(VAPID)가 설정되지 않아 사용할 수 없습니다.'
                    }
                  >
                    <div className="flex items-center gap-2">
                      {pushOn && (
                        <Button variant="ghost" size="sm" onClick={handleTestPush} disabled={pushBusy}>
                          테스트 발송
                        </Button>
                      )}
                      <Toggle on={pushOn} onToggle={handleTogglePush} disabled={!pushServerReady || pushBusy} />
                    </div>
                  </SettingRow>
                )}
                <SettingRow label="만기·결제 임박 알림" desc="예적금 만기·구독 결제/체험 종료 임박 시 알림">
                  <Toggle on={s.notifMaturity} onToggle={() => handleToggleNotif('notifMaturity')} />
                </SettingRow>
                <SettingRow label="파일 업로드 완료 알림" desc="파일 업로드 시 알림 표시">
                  <Toggle on={s.notifUpload} onToggle={() => handleToggleNotif('notifUpload')} />
                </SettingRow>
              </SettingGroup>
            </>
          )}

          {/* ── 데이터 ── */}
          {tab === 'data' && (
            <>
              <SettingGroup title="데이터 내보내기">
                <SettingRow label="가계부 데이터" desc="전체 거래 내역을 엑셀(.xlsx)로 다운로드">
                  <Button variant="ghost" onClick={() => exportData('/transactions/export', '가계부.xlsx')}>엑셀 다운로드</Button>
                </SettingRow>
                <SettingRow label="계정 보관함" desc="암호화된 JSON 형태로 백업 (같은 계정으로만 복원)">
                  <Button variant="ghost" onClick={() => exportData('/export/credentials', '계정백업.json')}>JSON 백업</Button>
                </SettingRow>
                <SettingRow label="전체 백업" desc="모든 데이터·메모를 ZIP으로 다운로드">
                  <Button variant="ghost" onClick={() => exportData('/export/backup', 'docnexus-백업.zip')}>ZIP 다운로드</Button>
                </SettingRow>
              </SettingGroup>

              <SettingGroup title="데이터 가져오기">
                <SettingRow label="계정 보관함 복원" desc="JSON 백업을 현재 보관함에 추가 (같은 계정의 백업만 · 덮어쓰지 않음)">
                  <label className="excel-btn upload">
                    JSON 복원
                    <input type="file" accept=".json,application/json" hidden onChange={handleImportCredentials} />
                  </label>
                </SettingRow>
                <SettingRow label="가계부 가져오기" desc="거래 내역 엑셀(.xlsx)은 가계부 페이지에서 업로드합니다.">
                  <Button variant="ghost" href="/transactions">가계부로 이동</Button>
                </SettingRow>
              </SettingGroup>
              <div className="bg-background border border-danger/20 rounded-panel overflow-hidden shadow-card">
                <div className="px-5 py-3.5 border-b border-danger/15 [font-family:var(--font-display)] font-bold text-[0.875rem] text-danger bg-danger-dim">위험 구역</div>
                <SettingRow labelClass="danger" label="계정 삭제" desc="모든 데이터가 영구 삭제됩니다. 되돌릴 수 없습니다.">
                  <Button variant="danger" onClick={handleDeleteAccount}>계정 삭제</Button>
                </SettingRow>
              </div>
            </>
          )}
        </div>
      </div>
      {confirmElement}
    </AppShell>
  );
}
