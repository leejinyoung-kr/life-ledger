'use client';

/**
 * 설정 페이지.
 * 좌측 탭(프로필/예산/카테고리/보안/API키/위젯/데이터)으로 분기하며,
 * 토글·위젯 드래그 정렬을 지원한다. 데이터는 백엔드 API(/settings)와 연동한다.
 * 스타일: Tailwind + 공통 컴포넌트(Button/Badge/Toggle).
 */
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { notify } from '@/lib/toast';
import AppShell from '@/components/AppShell';
import { useConfirm } from '@/components/ConfirmModal';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Toggle from '@/components/ui/Toggle';
import { IconWon, IconBars, IconClock, IconZap, IconLock, IconCube, IconDrag } from '@/components/icons';
import { api, apiDownload } from '@/lib/api';
import { clearVaultToken } from '@/lib/vault';
import {
  BUDGET_LABEL, SESSION_EXPIRY_OPTIONS, PW_AUTO_HIDE_OPTIONS, CLAUDE_MODEL_OPTIONS,
  MENU_ITEMS, DEFAULT_MENU_ORDER, normalizeMenuOrder,
  type Settings, type Category, type WidgetPref,
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
import { budgetApi, currentMonth, fmtMoney, type BudgetMonthStatus } from '@/lib/budget';

// 메뉴 key → 라벨
const MENU_LABEL: Record<string, string> = Object.fromEntries(MENU_ITEMS.map((m) => [m.key, m.label]));

type TabId = 'profile' | 'budget' | 'security' | 'api' | 'widgets' | 'data';
const TABS: { id: TabId; label: string }[] = [
  { id: 'profile', label: '프로필' },
  { id: 'budget', label: '예산 설정' },
  { id: 'security', label: '보안' },
  { id: 'api', label: 'API 키' },
  { id: 'widgets', label: '위젯 설정' },
  { id: 'data', label: '데이터' },
];

// 위젯 프레젠테이션 메타 (아이콘/설명/색 — 표시·순서 선호값은 서버에서 옴)
interface WidgetMeta { name: string; desc: string; tone: string; icon: ReactNode; emoji: string; short: string; }
const WIDGET_META: Record<string, WidgetMeta> = {
  'stat-cards': { name: '수입/지출 요약 카드', desc: '이번 달 수입, 지출, 잔액을 한눈에 표시', tone: 'green', icon: <IconWon width={16} height={16} />, emoji: '📊', short: '수입/지출 요약' },
  'budget-bars': { name: '카테고리별 지출 바', desc: '식비, 교통, 구독 등 카테고리별 예산 현황', tone: 'amber', icon: <IconBars width={16} height={16} />, emoji: '📉', short: '카테고리 지출' },
  'recent-activity': { name: '최근 활동', desc: '가계부 추가, 파일 업로드 등 최근 액션 목록', tone: 'blue', icon: <IconClock width={16} height={16} />, emoji: '🕐', short: '최근 활동' },
  'quick-actions': { name: '빠른 실행', desc: '지출 추가, 파일 업로드 등 자주 쓰는 액션 단축', tone: 'muted', icon: <IconZap width={16} height={16} />, emoji: '⚡', short: '빠른 실행' },
  'cred-count': { name: '저장된 계정 수', desc: '계정 보관함 총 개수 및 최근 추가 항목', tone: 'red', icon: <IconLock width={16} height={16} />, emoji: '🔐', short: '계정 수' },
  'ai-summary': { name: 'AI 리포트 요약', desc: '최신 AI 분석 인사이트 한 줄 요약', tone: 'accent', icon: <IconCube width={16} height={16} />, emoji: '🤖', short: 'AI 요약' },
};
const DEFAULT_WIDGETS: WidgetPref[] = [
  { id: 'stat-cards', on: true }, { id: 'budget-bars', on: true },
  { id: 'recent-activity', on: true }, { id: 'quick-actions', on: true },
  { id: 'cred-count', on: false }, { id: 'ai-summary', on: false },
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
  const [s, setS] = useState<Settings | null>(null);
  const [error, setError] = useState<string | null>(null);
  // 마스터 잠금
  const [vault, setVault] = useState<VaultStatus | null>(null);
  const [vaultPw, setVaultPw] = useState('');
  const [vaultTimeout, setVaultTimeout] = useState(5);
  const [vaultBusy, setVaultBusy] = useState(false);

  // 계정 보관함 JSON 백업 복원 (export 역방향) — 동일 CREDENTIAL_SECRET 전제
  async function importCredentials(e: React.ChangeEvent<HTMLInputElement>) {
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
  async function deleteAccount() {
    if (!await confirm('계정을 영구 삭제할까요? 모든 데이터가 사라지며 되돌릴 수 없습니다.', 'danger')) return;
    try {
      await api.del('/auth/me');
      localStorage.removeItem('auth_token');
      notify.success('계정이 삭제됐습니다.');
      router.push('/login');
    } catch {
      notify.error('계정 삭제에 실패했습니다.');
    }
  }

  // 로컬 편집 상태 (입력 중 값 — 저장 버튼으로 커밋)
  const [displayName, setDisplayName] = useState('');
  const [budgets, setBudgets] = useState<Record<string, number>>({});
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [claudeModel, setClaudeModel] = useState('claude-sonnet-4-6');
  const [newCatName, setNewCatName] = useState('');
  const [newCatEmoji, setNewCatEmoji] = useState('');
  const [widgets, setWidgets] = useState<WidgetPref[]>(DEFAULT_WIDGETS);
  const [dragId, setDragId] = useState<string | null>(null);
  const [menuOrder, setMenuOrder] = useState<string[]>(DEFAULT_MENU_ORDER);
  const [menuDragId, setMenuDragId] = useState<string | null>(null);

  // 월별 예산 현황
  const [budgetMonth, setBudgetMonth] = useState<string>(currentMonth());
  const [monthStatus, setMonthStatus] = useState<BudgetMonthStatus | null>(null);
  const [budgetStatusLoading, setBudgetStatusLoading] = useState(false);
  const [monthOverrides, setMonthOverrides] = useState<Record<string, number>>({});

  // 설정 조회 후 로컬 상태 초기화
  const load = useCallback(async () => {
    try {
      const data = await api.get<Settings>('/settings');
      setS(data);
      setDisplayName(data.displayName);
      setBudgets(data.budgets);
      setClaudeModel(data.claudeModel);
      setWidgets(data.widgets.length ? data.widgets : DEFAULT_WIDGETS);
      setMenuOrder(normalizeMenuOrder(data.menuOrder));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // 월별 예산 현황 로드
  const loadMonthStatus = useCallback(async (month: string) => {
    setBudgetStatusLoading(true);
    try {
      const data = await budgetApi.getStatus(month);
      setMonthStatus(data);
      const overMap: Record<string, number> = {};
      data.categories.forEach((c) => { if (c.isOverridden) overMap[c.category] = c.budget - c.carriedOver; });
      setMonthOverrides(overMap);
    } catch {
      setMonthStatus(null);
    } finally {
      setBudgetStatusLoading(false);
    }
  }, []);

  useEffect(() => { if (tab === 'budget') loadMonthStatus(budgetMonth); }, [tab, budgetMonth, loadMonthStatus]);

  // 부분 저장 — 변경 필드만 PUT, 응답으로 서버 상태 동기화
  // successMsg: null이면 알림 없음, 생략 시 기본 문구
  const patch = useCallback(async (partial: Record<string, unknown>, successMsg?: string | null) => {
    try {
      const data = await api.put<Settings>('/settings', partial);
      setS(data);
      setError(null);
      if (successMsg !== null) notify.success(successMsg ?? '저장됐습니다.');
      return data;
    } catch (e) {
      setError((e as Error).message);
      notify.error('저장에 실패했습니다.');
      throw e;
    }
  }, []);

  // 마스터 잠금 상태 로드 (보안 탭 진입 시)
  const loadVault = useCallback(async () => {
    try {
      const v = await api.get<VaultStatus>('/security/vault');
      setVault(v);
      setVaultTimeout(v.timeoutMin);
    } catch { /* 무시 */ }
  }, []);
  useEffect(() => { if (tab === 'security') loadVault(); }, [tab, loadVault]);

  // 마스터 잠금 설정/변경
  async function setupVault() {
    if (!vaultPw || vaultBusy) return;
    setVaultBusy(true);
    try {
      await api.post('/security/vault/setup', { password: vaultPw, timeoutMin: vaultTimeout });
      setVaultPw('');
      notify.success('마스터 잠금을 설정했습니다.');
      loadVault();
    } catch (e) { notify.error((e as Error).message); }
    finally { setVaultBusy(false); }
  }

  // 마스터 잠금 해제(비활성화) — 현재 비번 확인
  async function disableVault() {
    if (!vaultPw || vaultBusy) return;
    setVaultBusy(true);
    try {
      await api.post('/security/vault/disable', { password: vaultPw });
      setVaultPw('');
      clearVaultToken();
      notify.success('마스터 잠금을 해제했습니다.');
      loadVault();
    } catch (e) { notify.error((e as Error).message); }
    finally { setVaultBusy(false); }
  }

  if (!s) {
    return (
      <AppShell activePath="/settings" topbarLabel="설정">
        <div className="mb-7"><h1 className="[font-family:var(--font-display)] text-[1.55rem] font-bold tracking-[-0.03em] text-primary">설정</h1></div>
        {error ? <p className="mt-3 text-[0.78rem] text-danger">⚠️ {error}</p> : <p className="text-[0.82rem] text-secondary">불러오는 중...</p>}
      </AppShell>
    );
  }

  const NOTIF_LABEL: Record<string, string> = {
    notifBudget: '예산 초과 알림',
    notifMonthly: '월간 리포트 자동 생성',
    notifUpload: '파일 업로드 완료 알림',
    notifMaturity: '만기·결제 임박 알림',
    notifDeadline: '만료·마감 임박 알림',
  };

  // 알림 토글 — 즉시 저장
  const toggleNotif = (key: 'notifBudget' | 'notifMonthly' | 'notifUpload' | 'notifMaturity' | 'notifDeadline') => {
    const next = !s[key];
    const label = NOTIF_LABEL[key];
    patch({ [key]: next }, `${label}을(를) ${next ? '켰습니다.' : '껐습니다.'}`);
  };

  // 카테고리 삭제 — 즉시 저장
  function removeCategory(idx: number) {
    const next = s!.categories.filter((_, i) => i !== idx);
    patch({ categories: next });
  }

  // 카테고리 추가 — 즉시 저장
  function addCategory() {
    if (!newCatName.trim()) return;
    const next: Category[] = [...s!.categories, { emoji: newCatEmoji.trim() || '📁', name: newCatName.trim() }];
    patch({ categories: next }).then(() => { setNewCatName(''); setNewCatEmoji(''); });
  }

  // 위젯 표시 토글 — 즉시 저장
  async function toggleWidget(id: string) {
    const next = widgets.map((w) => (w.id === id ? { ...w, on: !w.on } : w));
    setWidgets(next);
    const toggled = next.find((w) => w.id === id);
    const label = WIDGET_META[id]?.name ?? '위젯';
    await patch({ widgets: next }, `${label}을(를) ${toggled?.on ? '켰습니다.' : '껐습니다.'}`);
  }

  // 드래그한 위젯을 대상 위치로 재배치 (로컬)
  function onDrop(targetId: string) {
    if (!dragId || dragId === targetId) return;
    setWidgets((prev) => {
      const arr = [...prev];
      const from = arr.findIndex((w) => w.id === dragId);
      const to = arr.findIndex((w) => w.id === targetId);
      const [moved] = arr.splice(from, 1);
      arr.splice(to, 0, moved);
      return arr;
    });
    setDragId(null);
  }

  // 드래그한 1차 메뉴를 대상 위치로 재배치 (로컬)
  function onMenuDrop(targetKey: string) {
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

  // 메뉴 순서 저장 → 사이드바 즉시 반영(window 이벤트)
  async function saveMenuOrder() {
    await patch({ menuOrder });
    window.dispatchEvent(new Event('menu-order-changed'));
  }

  // 메뉴 순서 기본값으로 초기화 (로컬)
  function resetMenuOrder() {
    setMenuOrder([...DEFAULT_MENU_ORDER]);
  }

  return (
    <AppShell activePath="/settings" topbarLabel="설정">
      <div className="mb-7">
        <h1 className="[font-family:var(--font-display)] text-[1.55rem] font-bold tracking-[-0.03em] text-primary">설정</h1>
        <p className="text-sm text-secondary mt-1.5">계정, 보안, 예산, 대시보드 위젯 등을 관리합니다.</p>
      </div>

      {error && <p className="mt-3 mb-3 text-[0.78rem] text-danger">⚠️ {error}</p>}

      <div className="grid grid-cols-[192px_1fr] gap-7 items-start max-md:grid-cols-1">
        {/* 탭 네비 */}
        <div className="bg-background border border-border rounded-lg p-2.5 flex flex-col gap-0.5 sticky top-[calc(var(--header-h)+28px)] shadow-(--shadow-sm) max-md:static max-md:flex-row max-md:flex-wrap">
          {TABS.map((t) => (
            <button key={t.id} type="button" className={`px-3 py-2 rounded-(--radius) text-[0.855rem] cursor-pointer transition-all font-medium text-left ${tab === t.id ? 'bg-accent-dim text-accent font-semibold' : 'text-secondary hover:bg-surface hover:text-primary'}`} onClick={() => setTab(t.id)}>{t.label}</button>
          ))}
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
                <Row label="표시 이름" desc="대시보드 상단에 표시되는 이름">
                  <input type="text" className="input w-45" value={displayName} onChange={(e) => setDisplayName(e.target.value)} aria-label="표시 이름" />
                  <Button variant="ghost" onClick={() => patch({ displayName })}>저장</Button>
                </Row>
              </Group>
              <Group title="알림">
                <Row label="예산 초과 알림" desc="카테고리 예산의 80% 이상 소비 시 알림">
                  <Toggle on={s.notifBudget} onToggle={() => toggleNotif('notifBudget')} />
                </Row>
                <Row label="만기·결제 임박 알림" desc="예적금 만기·구독 결제/체험 종료 임박 시 알림">
                  <Toggle on={s.notifMaturity} onToggle={() => toggleNotif('notifMaturity')} />
                </Row>
                <Row label="만료·마감 임박 알림" desc="신원 문서 만료·할일 마감 임박 시 알림">
                  <Toggle on={s.notifDeadline} onToggle={() => toggleNotif('notifDeadline')} />
                </Row>
                <Row label="월간 리포트 자동 생성" desc="매월 1일 전월 리포트 자동 생성">
                  <Toggle on={s.notifMonthly} onToggle={() => toggleNotif('notifMonthly')} />
                </Row>
                <Row label="파일 업로드 완료 알림" desc="파일 업로드 시 알림 표시">
                  <Toggle on={s.notifUpload} onToggle={() => toggleNotif('notifUpload')} />
                </Row>
              </Group>
            </>
          )}

          {/* ── 예산 설정 ── */}
          {tab === 'budget' && (
            <>
              {/* 기본 월 예산 */}
              <Group title="기본 월 예산">
                <p className="px-5 pt-3 pb-1 text-[0.82rem] text-muted">매달 기본으로 적용되는 예산입니다. 특정 달만 바꾸려면 아래 월별 설정을 사용하세요.</p>
                {Object.keys(BUDGET_LABEL).map((code) => (
                  <Row key={code} label={BUDGET_LABEL[code]}>
                    <input
                      type="number" className="input w-35"
                      value={budgets[code] ?? 0}
                      onChange={(e) => setBudgets((b) => ({ ...b, [code]: Number(e.target.value) }))}
                      aria-label={`${BUDGET_LABEL[code]} 예산`}
                    />
                    <span className="text-muted">원</span>
                  </Row>
                ))}
                <div className="flex items-center justify-end px-5 py-3.5">
                  <Button onClick={() => patch({ budgets })}>저장</Button>
                </div>
              </Group>

              {/* 월별 예산 현황 + 오버라이드 */}
              <Group title="월별 예산 현황">
                <div className="px-5 pt-4 pb-3 flex items-center gap-3 flex-wrap">
                  <input
                    type="month" className="input w-auto font-mono text-[0.875rem]"
                    value={budgetMonth}
                    onChange={(e) => setBudgetMonth(e.target.value)}
                    aria-label="조회 월"
                  />
                  <Button
                    variant="ghost"
                    onClick={async () => {
                      try {
                        await budgetApi.applyCarryover(budgetMonth);
                        notify.success('이월이 적용됐습니다.');
                        loadMonthStatus(budgetMonth);
                      } catch { notify.error('이월 적용에 실패했습니다.'); }
                    }}
                  >전달 잔액 이월</Button>
                  <Button
                    variant="ghost"
                    onClick={async () => {
                      try {
                        await budgetApi.resetCarryover(budgetMonth);
                        notify.success('이월이 초기화됐습니다.');
                        loadMonthStatus(budgetMonth);
                      } catch { notify.error('이월 초기화에 실패했습니다.'); }
                    }}
                  >이월 초기화</Button>
                </div>

                {budgetStatusLoading && <p className="px-5 pb-4 text-[0.82rem] text-muted">불러오는 중...</p>}

                {monthStatus && !budgetStatusLoading && (
                  <>
                    {/* 요약 */}
                    <div className="grid grid-cols-3 gap-px bg-border mx-5 mb-3 rounded-(--radius) overflow-hidden text-center text-[0.82rem]">
                      <div className="bg-background py-2.5 px-3">
                        <div className="text-muted">총 예산</div>
                        <div className="font-semibold text-primary mt-0.5">{fmtMoney(monthStatus.summary.totalBudget)}원</div>
                      </div>
                      <div className="bg-background py-2.5 px-3">
                        <div className="text-muted">지출</div>
                        <div className="font-semibold text-primary mt-0.5">{fmtMoney(monthStatus.summary.totalSpent)}원</div>
                      </div>
                      <div className="bg-background py-2.5 px-3">
                        <div className="text-muted">잔여</div>
                        <div className={`font-semibold mt-0.5 ${monthStatus.summary.totalRemaining < 0 ? 'text-danger' : 'text-accent'}`}>
                          {fmtMoney(monthStatus.summary.totalRemaining)}원
                        </div>
                      </div>
                    </div>

                    {/* 카테고리별 바 */}
                    {monthStatus.categories.map((cat) => (
                      <div key={cat.category} className="px-5 py-3 border-b border-border-subtle last:border-b-0">
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2">
                            <span className="text-[0.875rem] font-medium text-primary">{cat.label}</span>
                            {cat.isOverridden && <span className="text-[0.7rem] bg-accent-dim text-accent px-1.5 py-0.5 rounded font-medium">오버라이드</span>}
                            {cat.carriedOver > 0 && <span className="text-[0.7rem] bg-amber-dim text-amber px-1.5 py-0.5 rounded font-medium">+이월 {fmtMoney(cat.carriedOver)}원</span>}
                          </div>
                          <span className={`text-[0.78rem] font-medium ${cat.isOver ? 'text-danger' : 'text-muted'}`}>
                            {fmtMoney(cat.spent)} / {fmtMoney(cat.budget)}원
                          </span>
                        </div>
                        <div className="h-1.5 bg-surface rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${cat.isOver ? 'bg-danger' : cat.percent >= 80 ? 'bg-amber' : 'bg-accent'}`}
                            style={{ width: `${Math.min(cat.percent, 100)}%` }}
                          />
                        </div>
                        <div className="text-[0.75rem] text-muted mt-1">{cat.percent}% 소비 · 잔여 {fmtMoney(cat.remaining)}원</div>
                      </div>
                    ))}

                    {/* 이 달 오버라이드 편집 */}
                    <div className="px-5 pt-4 pb-2 border-t border-border mt-1">
                      <p className="text-[0.82rem] font-medium text-primary mb-3">이 달 예산 직접 설정 <span className="text-muted font-normal">(비워두면 기본값 적용)</span></p>
                      {monthStatus.categories.map((cat) => (
                        <div key={cat.category} className="flex items-center gap-2.5 mb-2">
                          <span className="text-[0.875rem] text-secondary w-16 shrink-0">{cat.label}</span>
                          <input
                            type="number"
                            className="input w-35"
                            placeholder={String(cat.defaultBudget)}
                            value={monthOverrides[cat.category] ?? ''}
                            onChange={(e) => setMonthOverrides((o) => ({ ...o, [cat.category]: Number(e.target.value) }))}
                            aria-label={`${cat.label} 이달 예산`}
                          />
                          <span className="text-muted text-[0.875rem]">원</span>
                        </div>
                      ))}
                      <div className="flex justify-end pt-2">
                        <Button
                          onClick={async () => {
                            const items = monthStatus.categories.map((cat) => ({
                              category: cat.category,
                              amount: monthOverrides[cat.category] ?? 0,
                            }));
                            try {
                              await budgetApi.upsert(budgetMonth, items);
                              notify.success('이달 예산이 저장됐습니다.');
                              loadMonthStatus(budgetMonth);
                            } catch { notify.error('저장에 실패했습니다.'); }
                          }}
                        >이달 예산 저장</Button>
                      </div>
                    </div>
                  </>
                )}
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
              <div className="mt-6 pt-5 border-t border-border-subtle">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[0.9rem] font-semibold text-primary">보관함 마스터 잠금</span>
                  <Badge tone={vault?.enabled ? 'success' : 'warning'}>{vault?.enabled ? '사용 중' : '미설정'}</Badge>
                </div>
                <p className="text-[0.78rem] text-secondary leading-relaxed mb-3 [word-break:keep-all]">
                  켜두면 비밀번호·신원번호·ENV 값을 열람할 때마다 마스터 비밀번호가 필요합니다. 설정한 시간 동안 비활성 시 자동으로 다시 잠깁니다.
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="password"
                    className="input w-50"
                    placeholder={vault?.enabled ? '현재 마스터 비밀번호' : '새 마스터 비밀번호 (4자 이상)'}
                    value={vaultPw}
                    onChange={(e) => setVaultPw(e.target.value)}
                    aria-label="마스터 비밀번호"
                  />
                  {!vault?.enabled && (
                    <select className="input w-auto" aria-label="자동잠금 시간" value={vaultTimeout} onChange={(e) => setVaultTimeout(Number(e.target.value))}>
                      {VAULT_TIMEOUT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  )}
                  {vault?.enabled
                    ? <Button variant="danger" disabled={vaultBusy || !vaultPw} onClick={disableVault}>잠금 해제</Button>
                    : <Button disabled={vaultBusy || !vaultPw} onClick={setupVault}>잠금 설정</Button>}
                </div>
                {vault?.enabled && (
                  <p className="text-[0.74rem] text-muted mt-2">자동잠금: {vault.timeoutMin > 0 ? `${vault.timeoutMin}분` : '수동'} · 변경하려면 해제 후 다시 설정하세요.</p>
                )}
              </div>
            </Group>
          )}

          {/* ── API 키 ── */}
          {tab === 'api' && (
            <Group title="Claude API">
              <Row label="API 키" desc={s.claudeApiKeySet ? `저장됨 (${s.claudeApiKeyMasked})` : 'AI 리포트 생성에 사용됩니다.'}>
                <input type="password" className="input w-50 font-mono" placeholder={s.claudeApiKeySet ? '변경하려면 입력' : 'sk-ant-api...'} value={apiKeyInput} onChange={(e) => setApiKeyInput(e.target.value)} aria-label="API 키" />
                <Button variant="ghost" onClick={() => patch({ claudeApiKey: apiKeyInput || undefined }).then(() => setApiKeyInput(''))}>저장</Button>
              </Row>
              <Row label="모델" desc="리포트 생성에 사용할 Claude 모델">
                <select className="input w-50 font-mono" aria-label="모델" value={claudeModel} onChange={(e) => { setClaudeModel(e.target.value); patch({ claudeModel: e.target.value }); }}>
                  {CLAUDE_MODEL_OPTIONS.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </Row>
            </Group>
          )}

          {/* ── 위젯 설정 ── */}
          {tab === 'widgets' && (
            <>
              <Group title="대시보드 위젯 표시 설정">
                <p className="px-5 pt-3 pb-1 text-[0.82rem] text-muted">표시할 위젯을 켜고 끌 수 있습니다. 드래그로 순서를 변경하세요.</p>
                {widgets.map((w) => {
                  const meta = WIDGET_META[w.id];
                  if (!meta) return null;
                  return (
                    <div
                      key={w.id}
                      className="flex items-center gap-3.5 px-5 py-3.5 border-b border-border-subtle last:border-b-0 transition-colors hover:bg-surface"
                      draggable
                      onDragStart={() => setDragId(w.id)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => onDrop(w.id)}
                    >
                      <span className="text-muted cursor-grab active:cursor-grabbing shrink-0 flex"><IconDrag width={14} height={14} /></span>
                      <div className={`w-9 h-9 rounded-[var(--radius)] flex items-center justify-center shrink-0 ${WIDGET_ICON_BG[meta.tone]}`}>{meta.icon}</div>
                      <div className="flex-1">
                        <div className="text-[0.875rem] font-medium text-primary">{meta.name}</div>
                        <div className={`text-[0.775rem] mt-0.5 ${w.on ? 'text-muted' : 'text-danger'}`}>{w.on ? meta.desc : '숨겨짐 · 대시보드에 표시되지 않습니다'}</div>
                      </div>
                      <Toggle on={w.on} onToggle={() => toggleWidget(w.id)} />
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
                    onDrop={() => onMenuDrop(key)}
                  >
                    <span className="text-muted cursor-grab active:cursor-grabbing shrink-0 flex"><IconDrag width={14} height={14} /></span>
                    <div className="flex-1 text-[0.875rem] font-medium text-primary">{MENU_LABEL[key] ?? key}</div>
                  </div>
                ))}
              </Group>

              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={resetMenuOrder}>초기화</Button>
                <Button onClick={saveMenuOrder}>메뉴 순서 저장</Button>
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
                <Row label="계정 보관함" desc="암호화된 JSON 형태로 백업 (동일 키 필요)">
                  <Button variant="ghost" onClick={() => exportData('/export/credentials', '계정백업.json')}>JSON 백업</Button>
                </Row>
                <Row label="전체 백업" desc="모든 데이터·메모를 ZIP으로 다운로드">
                  <Button variant="ghost" onClick={() => exportData('/export/backup', 'docnexus-백업.zip')}>ZIP 다운로드</Button>
                </Row>
              </Group>

              <Group title="데이터 가져오기">
                <Row label="계정 보관함 복원" desc="JSON 백업을 현재 보관함에 추가 (동일 키 필요 · 덮어쓰지 않음)">
                  <label className="excel-btn upload">
                    JSON 복원
                    <input type="file" accept=".json,application/json" hidden onChange={importCredentials} />
                  </label>
                </Row>
                <Row label="가계부 가져오기" desc="거래 내역 엑셀(.xlsx)은 가계부 페이지에서 업로드합니다.">
                  <Button variant="ghost" href="/transactions">가계부로 이동</Button>
                </Row>
              </Group>
              <div className="bg-background border border-[rgba(240,68,56,0.2)] rounded-[var(--radius-lg)] overflow-hidden shadow-[var(--shadow-sm)]">
                <div className="px-5 py-3.5 border-b border-[rgba(240,68,56,0.15)] [font-family:var(--font-display)] font-bold text-[0.875rem] text-danger bg-danger-dim">위험 구역</div>
                <Row labelClass="danger" label="계정 삭제" desc="모든 데이터가 영구 삭제됩니다. 되돌릴 수 없습니다.">
                  <Button variant="danger" onClick={deleteAccount}>계정 삭제</Button>
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
function Row({ label, desc, labelClass, children }: { label: string; desc?: string; labelClass?: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between px-5 py-3.5 border-b border-border-subtle last:border-b-0 gap-6">
      <div>
        <div className={`text-[0.875rem] font-medium ${labelClass === 'danger' ? 'text-danger' : 'text-primary'}`}>{label}</div>
        {desc && <div className="text-[0.78rem] text-muted mt-0.5">{desc}</div>}
      </div>
      <div className="shrink-0 flex items-center gap-2.5">{children}</div>
    </div>
  );
}

// 대시보드 실제 레이아웃을 그대로 미니맵으로 표현
function WidgetPreview({ widgets }: { widgets: WidgetPref[] }) {
  const wp = Object.fromEntries(widgets.map((w) => [w.id, w.on]));
  const cell = 'bg-background border border-border-subtle rounded-[var(--radius)] px-2 py-2 text-[0.65rem] text-muted transition-opacity';
  return (
    <div className="border border-border rounded-[var(--radius-lg)] bg-surface p-3 flex flex-col gap-1.5 select-none">
      {/* stat-cards: 4열 그리드 */}
      <div className={`grid grid-cols-4 gap-1.5 transition-opacity ${wp['stat-cards'] ? 'opacity-100' : 'opacity-25'}`}>
        {['지출', '수입', '순자산', '구독'].map((l) => (
          <div key={l} className={`${cell} text-center`}>{l}</div>
        ))}
      </div>
      {/* budget-bars + recent-activity: 2열 */}
      <div className="grid grid-cols-2 gap-1.5">
        <div className={`${cell} ${wp['budget-bars'] ? 'opacity-100' : 'opacity-25'}`}>📉 카테고리 지출</div>
        <div className={`${cell} ${wp['recent-activity'] ? 'opacity-100' : 'opacity-25'}`}>🕐 최근 활동</div>
      </div>
      {/* ai-summary: 풀 너비 */}
      <div className={`${cell} ${wp['ai-summary'] ? 'opacity-100' : 'opacity-25'}`}>🤖 AI 리포트 요약</div>
      {/* 다가오는 일정: 항상 표시 */}
      <div className={cell}>📅 다가오는 일정 <span className="opacity-50">(항상 표시)</span></div>
      {/* quick-actions: 4열 그리드 */}
      <div className={`grid grid-cols-4 gap-1.5 transition-opacity ${wp['quick-actions'] ? 'opacity-100' : 'opacity-25'}`}>
        {['지출 기록', '계정 추가', '파일 업로드', 'AI 리포트'].map((l) => (
          <div key={l} className={`${cell} text-center`}>{l}</div>
        ))}
      </div>
    </div>
  );
}
