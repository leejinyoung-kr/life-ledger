'use client';

/**
 * 설정 페이지.
 * 좌측 탭(프로필/보안/API키/위젯/데이터)으로 분기하며,
 * 토글·위젯 드래그 정렬을 지원한다. 데이터는 백엔드 API(/settings)와 연동한다.
 * 스타일: Tailwind + 공통 컴포넌트(Button/Badge/Toggle).
 */
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { notify } from '@/lib/toast';
import { eulreul } from '@/lib/korean';
import { useApiQuery } from '@/lib/query';
import { qk } from '@/lib/queryKeys';
import AppShell from '@/components/AppShell';
import ErrorBanner from '@/components/ErrorBanner';
import QueryError from '@/components/QueryError';
import { PageLoading } from '@/components/QueryState';
import { useConfirm } from '@/components/ConfirmModal';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Toggle from '@/components/ui/Toggle';
import { IconWon, IconClock, IconZap, IconLock, IconCube, IconDrag } from '@/components/icons';
import { api, apiDownload, setAccessToken } from '@/lib/api';
import { clearVaultToken } from '@/lib/vault';
import { isPushSupported, fetchPushStatus, getCurrentSubscription, enablePush, disablePush, sendTestPush } from '@/lib/push';
import {
  SESSION_EXPIRY_OPTIONS, PW_AUTO_HIDE_OPTIONS, OPENAI_MODEL_OPTIONS,
  MENU_ITEMS, DEFAULT_MENU_ORDER, normalizeMenuOrder,
  type Settings, type WidgetPref, type AiUsageSummary,
} from '@/lib/settings';
import type { VaultStatus } from '@/lib/security';

// 자동잠금 시간 옵션 (분)
const VAULT_TIMEOUT_OPTIONS = [
  { value: 0, label: '수동 잠금만' },
  { value: 5, label: '5분' },
  { value: 15, label: '15분' },
  { value: 30, label: '30분' },
  { value: 60, label: '1시간' },
];

// 메뉴 key → 라벨
const MENU_LABEL: Record<string, string> = Object.fromEntries(MENU_ITEMS.map((m) => [m.key, m.label]));

type TabId = 'profile' | 'security' | 'api' | 'widgets' | 'data';
const TABS: { id: TabId; label: string }[] = [
  { id: 'profile', label: '프로필' },
  { id: 'security', label: '보안' },
  { id: 'api', label: 'API 키' },
  { id: 'widgets', label: '위젯 설정' },
  { id: 'data', label: '데이터' },
];

// 위젯 프레젠테이션 메타 (아이콘/설명/색 — 표시·순서 선호값은 서버에서 옴)
interface WidgetMeta { name: string; desc: string; tone: string; icon: ReactNode; emoji: string; short: string; }
const WIDGET_META: Record<string, WidgetMeta> = {
  'stat-cards': { name: '수입/지출 요약 카드', desc: '이번 달 수입, 지출, 잔액을 한눈에 표시', tone: 'green', icon: <IconWon width={16} height={16} />, emoji: '📊', short: '수입/지출 요약' },
  'recent-activity': { name: '최근 활동', desc: '가계부 추가, 파일 업로드 등 최근 액션 목록', tone: 'blue', icon: <IconClock width={16} height={16} />, emoji: '🕐', short: '최근 활동' },
  'quick-actions': { name: '빠른 실행', desc: '지출 추가, 파일 업로드 등 자주 쓰는 액션 단축', tone: 'muted', icon: <IconZap width={16} height={16} />, emoji: '⚡', short: '빠른 실행' },
  'cred-count': { name: '저장된 계정 수', desc: '계정 보관함 총 개수 및 최근 추가 항목', tone: 'red', icon: <IconLock width={16} height={16} />, emoji: '🔐', short: '계정 수' },
  'ai-summary': { name: 'AI 리포트 요약', desc: '최신 AI 분석 인사이트 한 줄 요약', tone: 'accent', icon: <IconCube width={16} height={16} />, emoji: '🤖', short: 'AI 요약' },
};
const DEFAULT_WIDGETS: WidgetPref[] = [
  { id: 'stat-cards', on: true }, { id: 'recent-activity', on: true },
  { id: 'quick-actions', on: true }, { id: 'cred-count', on: false },
  { id: 'ai-summary', on: true },
];

// 위젯 아이콘 배경색 (tone → Tailwind)
const WIDGET_ICON_BG: Record<string, string> = {
  green: 'bg-accent-dim text-accent', amber: 'bg-amber-dim text-amber', blue: 'bg-blue-dim text-blue',
  red: 'bg-danger-dim text-danger', muted: 'bg-elevated text-secondary', accent: 'bg-accent-dim text-accent',
};

export default function SettingsPage() {
  const router = useRouter();
  const { confirm, confirmElement } = useConfirm();
  const [tab, setTab] = useState<TabId>('profile');
  // URL ?tab=api 진입 시 해당 탭 선택 (헤더 AI 배지 등 외부 링크용) — 클라이언트 마운트 후 1회
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get('tab');
    // eslint-disable-next-line react-hooks/set-state-in-effect -- URL 쿼리 기반 마운트 1회 탭 동기화
    if (t && TABS.some((x) => x.id === t)) setTab(t as TabId);
  }, []);
  const qc = useQueryClient();
  const settingsQuery = useApiQuery<Settings>(qk.settings.detail(), '/settings');
  const s = settingsQuery.data ?? null;
  const error = settingsQuery.error?.message ?? null;
  // 이번 달 AI 사용량 — API 탭 진입 시에만 조회
  const usageQuery = useApiQuery<AiUsageSummary>(qk.aiUsage.summary(), '/ai/usage', { enabled: tab === 'api' });
  const usage = usageQuery.data ?? null;
  // 마스터 잠금
  const [vault, setVault] = useState<VaultStatus | null>(null);
  const [vaultPw, setVaultPw] = useState('');
  const [vaultTimeout, setVaultTimeout] = useState(5);
  const [vaultSaving, setVaultSaving] = useState(false);

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
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [openaiModel, setOpenaiModel] = useState('gpt-4o-mini');
  // OpenAI 키 연결 확인 결과 (null=미확인)
  const [keyCheck, setKeyCheck] = useState<{ ok: boolean; model: string; modelAvailable: boolean } | null>(null);
  const [keyCheckBusy, setKeyCheckBusy] = useState(false);
  const [widgets, setWidgets] = useState<WidgetPref[]>(DEFAULT_WIDGETS);
  const [menuOrder, setMenuOrder] = useState<string[]>(DEFAULT_MENU_ORDER);
  const [menuDragId, setMenuDragId] = useState<string | null>(null);

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
    setOpenaiModel(data.openaiModel);
    setWidgets(data.widgets.length ? data.widgets : DEFAULT_WIDGETS);
    setMenuOrder(normalizeMenuOrder(data.menuOrder));
  }, [settingsQuery.data]);

  // 부분 저장 — 변경 필드만 PUT, 응답으로 서버 상태 동기화
  // successMsg: null이면 알림 없음, 생략 시 기본 문구
  const patch = useCallback(async (partial: Record<string, unknown>, successMsg?: string | null) => {
    try {
      const data = await api.put<Settings>('/settings', partial);
      qc.setQueryData(qk.settings.detail(), data); // 캐시 즉시 갱신
      if (successMsg !== null) notify.success(successMsg ?? '저장됐습니다.');
      return data;
    } catch (e) {
      notify.error('저장에 실패했습니다.');
      throw e;
    }
  }, [qc]);

  // 마스터 잠금 상태 로드 (보안 탭 진입 시)
  const loadVault = useCallback(async () => {
    try {
      const v = await api.get<VaultStatus>('/security/vault');
      setVault(v);
      setVaultTimeout(v.timeoutMin);
    } catch { /* 무시 */ }
  }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- 보안 탭 진입 시 잠금 상태 조회
  useEffect(() => { if (tab === 'security') loadVault(); }, [tab, loadVault]);

  // 마스터 잠금 설정/변경
  async function handleSetupVault() {
    if (!vaultPw || vaultSaving) return;
    setVaultSaving(true);
    try {
      await api.post('/security/vault/setup', { password: vaultPw, timeoutMin: vaultTimeout });
      setVaultPw('');
      notify.success('마스터 잠금을 설정했습니다.');
      loadVault();
    } catch (e) { notify.error((e as Error).message); }
    finally { setVaultSaving(false); }
  }

  // OpenAI 키 연결 확인 — 서버가 저장된 키로 /v1/models 호출해 유효성·모델 가용성 검사
  async function handleVerifyApiKey() {
    if (keyCheckBusy) return;
    setKeyCheckBusy(true);
    setKeyCheck(null);
    try {
      const r = await api.post<{ ok: boolean; model: string; modelAvailable: boolean }>('/ai/verify-key', {});
      setKeyCheck(r);
      if (r.modelAvailable) notify.success('연결 정상 · 모델 사용 가능');
      else notify.error(`연결됨 · 단 '${r.model}' 모델에 접근할 수 없습니다.`);
    } catch (e) {
      setKeyCheck({ ok: false, model: openaiModel, modelAvailable: false });
      notify.error((e as Error).message);
    } finally {
      setKeyCheckBusy(false);
    }
  }

  // 마스터 잠금 해제(비활성화) — 현재 비번 확인
  async function handleDisableVault() {
    if (!vaultPw || vaultSaving) return;
    setVaultSaving(true);
    try {
      await api.post('/security/vault/disable', { password: vaultPw });
      setVaultPw('');
      clearVaultToken();
      notify.success('마스터 잠금을 해제했습니다.');
      loadVault();
    } catch (e) { notify.error((e as Error).message); }
    finally { setVaultSaving(false); }
  }

  if (!s) {
    return (
      <AppShell activePath="/settings" topbarLabel="설정">
        <div className="mb-7"><h1 className="[font-family:var(--font-display)] text-[1.55rem] font-bold tracking-[-0.03em] text-primary">설정</h1></div>
        {settingsQuery.isError
          ? <QueryError message={error ?? undefined} onRetry={settingsQuery.refetch} />
          : <PageLoading className="py-0! text-left! text-[0.82rem] text-secondary" />}
      </AppShell>
    );
  }

  const NOTIF_LABEL: Record<string, string> = {
    notifMonthly: '월간 리포트 자동 생성',
    notifUpload: '파일 업로드 완료 알림',
    notifMaturity: '만기·결제 임박 알림',
    notifDeadline: '만료·마감 임박 알림',
  };

  // 알림 토글 — 즉시 저장
  const handleToggleNotif = (key: 'notifMonthly' | 'notifUpload' | 'notifMaturity' | 'notifDeadline') => {
    const next = !s[key];
    const label = NOTIF_LABEL[key];
    patch({ [key]: next }, `${label}${eulreul(label)} ${next ? '켰습니다.' : '껐습니다.'}`);
  };

  // 위젯 표시 토글 — 즉시 저장
  async function handleToggleWidget(id: string) {
    const next = widgets.map((w) => (w.id === id ? { ...w, on: !w.on } : w));
    setWidgets(next);
    const toggled = next.find((w) => w.id === id);
    const label = WIDGET_META[id]?.name ?? '위젯';
    await patch({ widgets: next }, `${label}${eulreul(label)} ${toggled?.on ? '켰습니다.' : '껐습니다.'}`);
  }

  // 드래그한 1차 메뉴를 대상 위치로 재배치 (로컬)
  function handleMenuDrop(targetKey: string) {
    if (!menuDragId || menuDragId === targetKey) return;
    setMenuOrder((prev) => {
      const arr = [...prev];
      const from = arr.indexOf(menuDragId);
      const to = arr.indexOf(targetKey);
      const [moved] = arr.splice(from, 1);
      arr.splice(to, 0, moved);
      return arr;
    });
    setMenuDragId(null);
  }

  // 메뉴 순서 저장 → patch 가 ['settings'] 캐시를 갱신하면 사이드바(useQuery)가 자동 반영
  async function handleSaveMenuOrder() {
    await patch({ menuOrder });
  }

  // 메뉴 순서 기본값으로 초기화 (로컬)
  function handleResetMenuOrder() {
    setMenuOrder([...DEFAULT_MENU_ORDER]);
  }

  return (
    <AppShell activePath="/settings" topbarLabel="설정">
      <div className="mb-7">
        <h1 className="[font-family:var(--font-display)] text-[1.55rem] font-bold tracking-[-0.03em] text-primary">설정</h1>
        <p className="text-sm text-secondary mt-1.5">계정, 보안, 대시보드 위젯 등을 관리합니다.</p>
      </div>

      <ErrorBanner message={error} />

      <div className="grid grid-cols-[192px_1fr] gap-7 items-start max-md:grid-cols-1">
        {/* 탭 네비 */}
        <div className="relative max-md:static">
          <div className="bg-background border border-border rounded-lg p-2.5 flex flex-col gap-0.5 sticky top-[calc(var(--header-h)+28px)] shadow-(--shadow-sm) max-md:static max-md:flex-row max-md:flex-nowrap max-md:overflow-x-auto max-md:scrollbar-none">
            {TABS.map((t) => (
              <button key={t.id} type="button" className={`px-3 py-2 rounded-(--radius) text-[0.855rem] cursor-pointer transition-all font-medium text-left whitespace-nowrap shrink-0 ${tab === t.id ? 'bg-accent-dim text-accent font-semibold' : 'text-secondary hover:bg-surface hover:text-primary'}`} onClick={() => setTab(t.id)}>{t.label}</button>
            ))}
          </div>
          <div className="hidden max-md:block absolute top-0 right-0 bottom-0 w-6 rounded-r-lg bg-linear-to-l from-background to-transparent pointer-events-none" />
        </div>

        <div className="flex flex-col gap-4">
          {/* ── 프로필 ── */}
          {tab === 'profile' && (
            <>
              <Group title="내 계정">
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
              </Group>
              <Group title="알림">
                {pushSupported && (
                  <Row
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
                  </Row>
                )}
                <Row label="만기·결제 임박 알림" desc="예적금 만기·구독 결제/체험 종료 임박 시 알림">
                  <Toggle on={s.notifMaturity} onToggle={() => handleToggleNotif('notifMaturity')} />
                </Row>
                <Row label="만료·마감 임박 알림" desc="신원 문서 만료·할일 마감 임박 시 알림">
                  <Toggle on={s.notifDeadline} onToggle={() => handleToggleNotif('notifDeadline')} />
                </Row>
                <Row label="월간 리포트 자동 생성" desc="매월 1일 전월 리포트 자동 생성">
                  <Toggle on={s.notifMonthly} onToggle={() => handleToggleNotif('notifMonthly')} />
                </Row>
                <Row label="파일 업로드 완료 알림" desc="파일 업로드 시 알림 표시">
                  <Toggle on={s.notifUpload} onToggle={() => handleToggleNotif('notifUpload')} />
                </Row>
              </Group>
            </>
          )}

          {/* ── 보안 ── */}
          {tab === 'security' && (
            <Group title="암호화 설정">
              <Row label="암호화 방식" desc="계정 보관함 비밀번호 암호화 알고리즘">
                <Badge tone="success">AES-256-GCM</Badge>
              </Row>
              <Row label="세션 자동 만료" desc="비활성 시간 후 자동 로그아웃">
                <select className="input w-auto" aria-label="세션 자동 만료" value={s.sessionExpiry} onChange={(e) => patch({ sessionExpiry: e.target.value })}>
                  {SESSION_EXPIRY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </Row>
              <Row label="비밀번호 자동 숨김" desc="계정 상세 모달에서 PW 표시 후 자동 숨김 시간">
                <select className="input w-auto" aria-label="비밀번호 자동 숨김" value={s.pwAutoHide} onChange={(e) => patch({ pwAutoHide: e.target.value })}>
                  {PW_AUTO_HIDE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </Row>

              {/* 마스터 잠금 — Google 로그인 외 보관함 2차 잠금 */}
              <div className="flex flex-col gap-2.5 px-5 py-3.5 border-t border-border-subtle sm:flex-row sm:items-center sm:justify-between sm:gap-6">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[0.875rem] font-medium text-primary">보관함 마스터 잠금</span>
                    <Badge tone={vault?.enabled ? 'success' : 'warning'}>{vault?.enabled ? '사용 중' : '미설정'}</Badge>
                  </div>
                  <div className="text-[0.78rem] text-muted break-keep">
                    켜두면 비밀번호·신원번호·ENV 값을 열람할 때마다 마스터 비밀번호가 필요합니다.
                  </div>
                  {vault?.enabled && (
                    <div className="text-[0.74rem] text-muted mt-1">자동잠금: {vault.timeoutMin > 0 ? `${vault.timeoutMin}분` : '수동'} · 변경하려면 해제 후 다시 설정하세요.</div>
                  )}
                </div>
                <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:shrink-0">
                  <input
                    type="password"
                    className="input sm:w-56"
                    placeholder={vault?.enabled ? '현재 마스터 비밀번호' : '새 마스터 비밀번호 (4자 이상)'}
                    value={vaultPw}
                    onChange={(e) => setVaultPw(e.target.value)}
                    aria-label="마스터 비밀번호"
                  />
                  <div className="flex items-center gap-1.5">
                    {!vault?.enabled && (
                      <select className="input w-auto" aria-label="자동잠금 시간" value={vaultTimeout} onChange={(e) => setVaultTimeout(Number(e.target.value))}>
                        {VAULT_TIMEOUT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    )}
                    {vault?.enabled
                      ? <Button variant="danger" disabled={vaultSaving || !vaultPw} onClick={handleDisableVault}>잠금 해제</Button>
                      : <Button disabled={vaultSaving || !vaultPw} onClick={handleSetupVault}>잠금 설정</Button>}
                  </div>
                </div>
              </div>
            </Group>
          )}

          {/* ── API 키 ── */}
          {tab === 'api' && (
            <>
            <Group title="OpenAI API">
              <div className="flex flex-col gap-2.5 px-5 py-3.5 border-b border-border-subtle last:border-b-0 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
                <div className="min-w-0">
                  <div className="text-[0.875rem] font-medium text-primary">API 키</div>
                  <div className="text-[0.78rem] text-muted mt-0.5">{s.openaiApiKeySet ? `저장됨 (${s.openaiApiKeyMasked})` : 'AI 리포트 생성에 사용됩니다.'}</div>
                </div>
                <div className="flex items-center gap-2.5 sm:shrink-0">
                  <input type="password" className="input flex-1 min-w-0 font-mono sm:w-50 sm:flex-none" placeholder={s.openaiApiKeySet ? '변경하려면 입력' : 'sk-proj-...'} value={apiKeyInput} onChange={(e) => setApiKeyInput(e.target.value)} aria-label="API 키" />
                  <Button onClick={() => patch({ openaiApiKey: apiKeyInput || undefined }).then(() => { setApiKeyInput(''); setKeyCheck(null); })}>저장</Button>
                </div>
              </div>
              <Row label="모델" desc="리포트 생성에 사용할 OpenAI 모델" stack>
                <select className="input w-50 font-mono" aria-label="모델" value={openaiModel} onChange={(e) => { setOpenaiModel(e.target.value); setKeyCheck(null); patch({ openaiModel: e.target.value }); }}>
                  {OPENAI_MODEL_OPTIONS.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </Row>
              <Row label="연결 확인" desc="저장된 키로 OpenAI 연결 상태와 선택한 모델의 접근 가능 여부를 확인합니다." stack>
                {keyCheck && (
                  <Badge tone={keyCheck.modelAvailable ? 'success' : keyCheck.ok ? 'warning' : 'danger'}>
                    {keyCheck.modelAvailable ? '정상' : keyCheck.ok ? '모델 접근 불가' : '연결 실패'}
                  </Badge>
                )}
                <Button variant="ghost" disabled={!s.openaiApiKeySet || keyCheckBusy} onClick={handleVerifyApiKey}>
                  {keyCheckBusy ? '확인 중...' : '연결 확인'}
                </Button>
              </Row>
              <Row label="크레딧 잔액" desc="OpenAI는 잔액 조회 API를 제공하지 않습니다. 사용량·잔액은 OpenAI 대시보드에서 확인하세요." stack>
                <Button variant="ghost" href="https://platform.openai.com/usage" target="_blank" rel="noopener noreferrer">대시보드 열기</Button>
              </Row>
            </Group>

            <Group title={`이번 달 사용량${usage ? ` (${usage.month})` : ''}`}>
              <p className="px-5 pt-3 pb-1 text-[0.82rem] text-muted">앱에서 발생한 OpenAI 호출의 토큰·비용 누적입니다. 단가표 기준 추정치이며 실제 청구액과 다를 수 있습니다.</p>
              {!usage ? (
                <p className="px-5 py-4 text-[0.82rem] text-secondary">{usageQuery.isLoading ? '불러오는 중...' : '데이터가 없습니다.'}</p>
              ) : usage.calls === 0 ? (
                <p className="px-5 py-4 text-[0.82rem] text-secondary">이번 달 사용 내역이 없습니다.</p>
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-3 px-5 py-4 max-md:grid-cols-1">
                    <UsageStat label="예상 비용" value={`$${usage.costUsd.toFixed(4)}`} tone="accent" />
                    <UsageStat label="총 토큰" value={usage.totalTokens.toLocaleString()} tone="blue" />
                    <UsageStat label="호출 수" value={`${usage.calls.toLocaleString()}회`} tone="muted" />
                  </div>
                  <div className="px-5 pb-2 text-[0.74rem] text-muted">
                    입력 {usage.promptTokens.toLocaleString()} · 출력 {usage.completionTokens.toLocaleString()} 토큰
                    {usage.lastUsedAt && ` · 최근 ${new Date(usage.lastUsedAt).toLocaleString('ko-KR')}`}
                  </div>
                  {usage.byModel.map((bm) => (
                    <Row key={bm.model} label={bm.model} desc={`${bm.calls.toLocaleString()}회 · ${bm.totalTokens.toLocaleString()} 토큰`}>
                      <span className="text-[0.82rem] font-mono text-secondary">${bm.costUsd.toFixed(4)}</span>
                    </Row>
                  ))}
                </>
              )}
            </Group>
            </>
          )}

          {/* ── 위젯 설정 ── */}
          {tab === 'widgets' && (
            <>
              <Group title="대시보드 위젯 표시 설정">
                <p className="px-5 pt-3 pb-1 text-[0.82rem] text-muted">표시할 위젯을 켜고 끌 수 있습니다.</p>
                {widgets.map((w) => {
                  const meta = WIDGET_META[w.id];
                  if (!meta) return null;
                  return (
                    <div
                      key={w.id}
                      className="flex items-center gap-3.5 px-5 py-3.5 border-b border-border-subtle last:border-b-0 transition-colors hover:bg-surface"
                    >
                      <div className={`w-9 h-9 rounded-[var(--radius)] flex items-center justify-center shrink-0 ${WIDGET_ICON_BG[meta.tone]}`}>{meta.icon}</div>
                      <div className="flex-1">
                        <div className="text-[0.875rem] font-medium text-primary">{meta.name}</div>
                        <div className={`text-[0.775rem] mt-0.5 ${w.on ? 'text-muted' : 'text-danger'}`}>{w.on ? meta.desc : '숨겨짐 · 대시보드에 표시되지 않습니다'}</div>
                      </div>
                      <Toggle on={w.on} onToggle={() => handleToggleWidget(w.id)} />
                    </div>
                  );
                })}
              </Group>

              <Group title="위젯 미리보기">
                <div className="px-5 py-4">
                  <WidgetPreview widgets={widgets} />
                </div>
                <div className="px-5 pt-2 pb-3 text-[0.82rem] text-muted">토글 변경 시 대시보드에 즉시 반영됩니다.</div>
              </Group>

              <Group title="사이드바 메뉴 순서">
                <p className="px-5 pt-3 pb-1 text-[0.82rem] text-muted">1차 메뉴(그룹)의 표시 순서를 드래그로 변경합니다. 저장 시 사이드바에 즉시 반영됩니다.</p>
                {menuOrder.map((key) => (
                  <div
                    key={key}
                    className="flex items-center gap-3.5 px-5 py-3 border-b border-border-subtle last:border-b-0 transition-colors hover:bg-surface"
                    draggable
                    onDragStart={() => setMenuDragId(key)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => handleMenuDrop(key)}
                  >
                    <span className="text-muted cursor-grab active:cursor-grabbing shrink-0 flex"><IconDrag width={14} height={14} /></span>
                    <div className="flex-1 text-[0.875rem] font-medium text-primary">{MENU_LABEL[key] ?? key}</div>
                  </div>
                ))}
              </Group>

              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={handleResetMenuOrder}>초기화</Button>
                <Button onClick={handleSaveMenuOrder}>메뉴 순서 저장</Button>
              </div>
            </>
          )}

          {/* ── 데이터 ── */}
          {tab === 'data' && (
            <>
              <Group title="데이터 내보내기">
                <Row label="가계부 데이터" desc="전체 거래 내역을 엑셀(.xlsx)로 다운로드">
                  <Button variant="ghost" onClick={() => exportData('/transactions/export', '가계부.xlsx')}>엑셀 다운로드</Button>
                </Row>
                <Row label="계정 보관함" desc="암호화된 JSON 형태로 백업 (같은 계정으로만 복원)">
                  <Button variant="ghost" onClick={() => exportData('/export/credentials', '계정백업.json')}>JSON 백업</Button>
                </Row>
                <Row label="전체 백업" desc="모든 데이터·메모를 ZIP으로 다운로드">
                  <Button variant="ghost" onClick={() => exportData('/export/backup', 'docnexus-백업.zip')}>ZIP 다운로드</Button>
                </Row>
              </Group>

              <Group title="데이터 가져오기">
                <Row label="계정 보관함 복원" desc="JSON 백업을 현재 보관함에 추가 (같은 계정의 백업만 · 덮어쓰지 않음)">
                  <label className="excel-btn upload">
                    JSON 복원
                    <input type="file" accept=".json,application/json" hidden onChange={handleImportCredentials} />
                  </label>
                </Row>
                <Row label="가계부 가져오기" desc="거래 내역 엑셀(.xlsx)은 가계부 페이지에서 업로드합니다.">
                  <Button variant="ghost" href="/transactions">가계부로 이동</Button>
                </Row>
              </Group>
              <div className="bg-background border border-[rgba(240,68,56,0.2)] rounded-[var(--radius-lg)] overflow-hidden shadow-[var(--shadow-sm)]">
                <div className="px-5 py-3.5 border-b border-[rgba(240,68,56,0.15)] [font-family:var(--font-display)] font-bold text-[0.875rem] text-danger bg-danger-dim">위험 구역</div>
                <Row labelClass="danger" label="계정 삭제" desc="모든 데이터가 영구 삭제됩니다. 되돌릴 수 없습니다.">
                  <Button variant="danger" onClick={handleDeleteAccount}>계정 삭제</Button>
                </Row>
              </div>
            </>
          )}
        </div>
      </div>
      {confirmElement}
    </AppShell>
  );
}

// 설정 그룹 (헤더 + 행 묶음)
function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="bg-background border border-border rounded-[var(--radius-lg)] overflow-hidden shadow-[var(--shadow-sm)]">
      <div className="px-5 py-3.5 border-b border-border [font-family:var(--font-display)] font-bold text-[0.875rem] text-primary bg-surface">{title}</div>
      {children}
    </div>
  );
}

// 설정 행 (라벨/설명 + 우측 컨트롤)
// stack: 컨트롤이 select/button 등으로 넓어 모바일에서 라벨과 줄바꿈이 필요한 행에만 true (기본은 토글류처럼 한 줄 유지)
function Row({ label, desc, labelClass, stack, children }: { label: string; desc?: string; labelClass?: string; stack?: boolean; children: ReactNode }) {
  return (
    <div className={`flex px-5 py-3.5 border-b border-border-subtle last:border-b-0 gap-6 ${stack ? 'flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between' : 'items-center justify-between'}`}>
      <div className={stack ? 'min-w-0' : 'flex-1 min-w-0'}>
        <div className={`text-[0.875rem] font-medium ${labelClass === 'danger' ? 'text-danger' : 'text-primary'}`}>{label}</div>
        {desc && <div className="text-[0.78rem] text-muted mt-0.5 break-keep">{desc}</div>}
      </div>
      <div className={`flex items-center gap-2.5 ${stack ? 'sm:shrink-0' : 'shrink-0'}`}>{children}</div>
    </div>
  );
}

// 사용량 통계 카드 (라벨 + 큰 값 + tone 색)
function UsageStat({ label, value, tone }: { label: string; value: string; tone: 'accent' | 'blue' | 'muted' }) {
  const toneCls: Record<string, string> = {
    accent: 'text-accent',
    blue: 'text-blue',
    muted: 'text-primary',
  };
  return (
    <div className="bg-surface border border-border-subtle rounded-[var(--radius)] px-4 py-3">
      <div className="text-[0.74rem] text-muted">{label}</div>
      <div className={`[font-family:var(--font-display)] text-[1.25rem] font-bold mt-1 ${toneCls[tone]}`}>{value}</div>
    </div>
  );
}

// 토글 가능 위젯 셀 — on/off 상태 반영
function WidgetCell({ on, children, center }: { on: boolean; children: ReactNode; center?: boolean }) {
  return (
    <div className={`bg-background border rounded-[var(--radius)] px-2 py-1.5 text-[0.68rem] whitespace-nowrap overflow-hidden text-ellipsis transition-all
      ${on ? 'border-border text-secondary' : 'border-border-subtle text-muted opacity-40 line-through'}
      ${center ? 'text-center' : ''}`}
    >
      {children}
    </div>
  );
}

// 항상 표시되는 셀 (데이터 조건부)
function AlwaysCell({ children }: { children: ReactNode }) {
  return (
    <div className="bg-surface border border-dashed border-border rounded-[var(--radius)] px-2 py-1.5 text-[0.68rem] text-muted whitespace-nowrap overflow-hidden text-ellipsis">
      {children}
    </div>
  );
}

// 대시보드 실제 레이아웃(2-컬럼)을 미니맵으로 표현
function WidgetPreview({ widgets }: { widgets: WidgetPref[] }) {
  const wp = Object.fromEntries(widgets.map((w) => [w.id, w.on]));

  return (
    <div className="border border-border rounded-[var(--radius-lg)] bg-surface p-3 flex flex-col gap-2 select-none">
      {/* 현황 카드 — 전체 너비 4열 */}
      <div className="grid grid-cols-4 gap-1.5">
        {['지출', '수입', '순자산', '구독'].map((l) => (
          <WidgetCell key={l} on={wp['stat-cards']} center>{l}</WidgetCell>
        ))}
      </div>

      {/* 2-컬럼: 좌(메인) + 우(사이드바) */}
      <div className="grid grid-cols-[2fr_1fr] gap-1.5 items-start">
        <div className="flex flex-col gap-1.5">
          <WidgetCell on={wp['recent-activity']}>🕐 최근 활동</WidgetCell>
          <WidgetCell on={wp['ai-summary']}>🤖 AI 리포트 요약</WidgetCell>
          <AlwaysCell>💸 고정지출 예측</AlwaysCell>
        </div>
        <div className="flex flex-col gap-1.5">
          <AlwaysCell>⏳ 만료·마감</AlwaysCell>
          <AlwaysCell>📅 다가오는 일정</AlwaysCell>
        </div>
      </div>

      {/* 빠른 실행 — 전체 너비 4열 */}
      <div className="grid grid-cols-4 gap-1.5">
        {['지출 기록', '계정 추가', '파일 업로드', 'AI 리포트'].map((l) => (
          <WidgetCell key={l} on={wp['quick-actions']} center>{l}</WidgetCell>
        ))}
      </div>

      <div className="flex items-center gap-3 pt-1 text-[0.62rem] text-muted">
        <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-[2px] border border-border bg-background" /> 토글 위젯</span>
        <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-[2px] border border-dashed border-border bg-surface" /> 항상 표시</span>
      </div>
    </div>
  );
}
