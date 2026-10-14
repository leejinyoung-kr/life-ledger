'use client';

/**
 * 설정 페이지.
 * 내 계정 · 알림 · 데이터 · 위험 구역을 한 페이지에 위아래로 묶는다. 데이터는 백엔드 API(/settings)와 연동한다.
 */
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { notify } from '@/lib/toast';
import { eulreul } from '@/lib/korean';
import { useApiQuery } from '@/lib/query';
import { qk } from '@/lib/queryKeys';
import AppShell from '@/components/AppShell';
import PageHeader from '@/components/PageHeader';
import { IconArchive, IconDownload, IconSend, IconUpload } from '@/components/icons';
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

export default function SettingsPage() {
  const router = useRouter();
  const { confirm, confirmElement } = useConfirm();
  const settingsQuery = useApiQuery<Settings>(qk.settings.detail(), '/settings');
  const s = settingsQuery.data ?? null;
  const error = settingsQuery.error?.message ?? null;

  // 계정 보관함 JSON 백업 복원 (export 역방향) — 같은 계정 + 백업에 쓰인 암호화 키가 서버에 남아 있어야 복원된다
  async function handleImportCredentials(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!await confirm('계정 백업 JSON 을 현재 보관함에 추가할까요? 덮어쓰지 않고 추가됩니다.', 'primary', '추가')) return;
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
    if (!await confirm('계정을 영구 삭제할까요? 모든 데이터가 사라지며 되돌릴 수 없습니다.', 'danger', '계정 삭제')) return;
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
      <AppShell activePath="/settings">
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
    <AppShell activePath="/settings">
      <PageHeader title="설정" description="계정, 알림, 데이터 백업 등을 관리합니다." />

      <ErrorBanner message={error} />

      {/* 넓은 화면은 두 열 — 왼쪽 계정 · 알림, 오른쪽 데이터 · 위험 구역 (높이가 비슷하게 나뉜다) */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
        <div className="flex flex-col gap-6 min-w-0">
          <SettingGroup title="내 계정">
            <div className="flex items-center gap-3.5 px-4.5 py-4 border-b border-border-subtle">
              <span className="w-12 h-12 rounded-full border border-accent text-accent-dark flex items-center justify-center text-[1.125rem] shrink-0">{(s.displayName || s.user.name || '?').charAt(0)}</span>
              <div className="flex-1 min-w-0 leading-snug">
                <div className="font-semibold text-primary truncate">{s.displayName}</div>
                <div className="text-[0.8125rem] text-muted truncate">{s.user.email}</div>
              </div>
              {s.user.google && <Badge tone="success">Google 연결됨</Badge>}
            </div>
            <SettingRow stack label="표시 이름" desc="대시보드 상단에 표시되는 이름">
              <input type="text" className="input flex-1 min-w-0 sm:w-50 sm:flex-none" value={displayName} onChange={(e) => setDisplayName(e.target.value)} aria-label="표시 이름" />
              <Button onClick={() => patch({ displayName })}>저장</Button>
            </SettingRow>
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
                {pushOn && (
                  <Button variant="ghost" size="sm" onClick={handleTestPush} disabled={pushBusy}>
                    <IconSend />테스트 발송
                  </Button>
                )}
                <Toggle on={pushOn} onToggle={handleTogglePush} disabled={!pushServerReady || pushBusy} />
              </SettingRow>
            )}
            <SettingRow label="만기·결제 임박 알림" desc="예적금 만기·구독 결제/체험 종료 임박 시 알림">
              <Toggle on={s.notifMaturity} onToggle={() => handleToggleNotif('notifMaturity')} />
            </SettingRow>
            <SettingRow label="파일 업로드 완료 알림" desc="파일 업로드 시 알림 표시">
              <Toggle on={s.notifUpload} onToggle={() => handleToggleNotif('notifUpload')} />
            </SettingRow>
          </SettingGroup>
        </div>

        <div className="flex flex-col gap-6 min-w-0">
          <SettingGroup title="데이터">
            <SettingRow stack label="가계부 데이터" desc="전체 거래 내역을 엑셀(.xlsx)로 다운로드">
              <Button variant="ghost" size="sm" onClick={() => exportData('/transactions/export', '가계부.xlsx')}><IconDownload />엑셀 다운로드</Button>
            </SettingRow>
            <SettingRow stack label="계정 보관함" desc="암호화된 JSON 으로 백업합니다. 복원은 같은 계정의 백업만, 현재 보관함에 추가됩니다 (덮어쓰지 않음).">
              <Button variant="ghost" size="sm" onClick={() => exportData('/export/credentials', '계정백업.json')}><IconDownload />JSON 백업</Button>
              <label className="excel-btn upload border border-border">
                <IconUpload width={15} height={15} />JSON 복원
                <input type="file" accept=".json,application/json" hidden onChange={handleImportCredentials} />
              </label>
            </SettingRow>
            <SettingRow stack label="전체 백업" desc="모든 데이터·메모를 ZIP으로 다운로드">
              <Button variant="ghost" size="sm" onClick={() => exportData('/export/backup', 'life-ledger-백업.zip')}><IconArchive />ZIP 다운로드</Button>
            </SettingRow>
            <SettingRow stack label="가계부 가져오기" desc="거래 내역 엑셀(.xlsx)은 가계부 페이지에서 업로드합니다.">
              <Button variant="ghost" size="sm" href="/transactions">가계부로 이동</Button>
            </SettingRow>
          </SettingGroup>

          <SettingGroup title="위험 구역" tone="danger">
            <SettingRow stack labelClass="danger" label="계정 삭제" desc="계정을 삭제하면 모든 데이터와 파일이 지워지고 되돌릴 수 없습니다.">
              <Button variant="danger" onClick={handleDeleteAccount}>계정 삭제</Button>
            </SettingRow>
          </SettingGroup>
        </div>
      </div>
      {confirmElement}
    </AppShell>
  );
}
