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
import {
  BUDGET_LABEL, SESSION_EXPIRY_OPTIONS, PW_AUTO_HIDE_OPTIONS, CLAUDE_MODEL_OPTIONS,
  MENU_ITEMS, DEFAULT_MENU_ORDER, normalizeMenuOrder,
  type Settings, type Category, type WidgetPref,
} from '@/lib/settings';

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

  // 부분 저장 — 변경 필드만 PUT, 응답으로 서버 상태 동기화
  const patch = useCallback(async (partial: Record<string, unknown>) => {
    try {
      const data = await api.put<Settings>('/settings', partial);
      setS(data);
      setError(null);
      return data;
    } catch (e) {
      setError((e as Error).message);
      throw e;
    }
  }, []);

  if (!s) {
    return (
      <AppShell activePath="/settings" topbarLabel="설정">
        <div className="mb-7"><h1 className="[font-family:var(--font-display)] text-[1.55rem] font-bold tracking-[-0.03em] text-primary">설정</h1></div>
        {error ? <p className="mt-3 text-[0.78rem] text-danger">⚠️ {error}</p> : <p className="text-[0.82rem] text-secondary">불러오는 중...</p>}
      </AppShell>
    );
  }

  // 알림 토글 — 즉시 저장
  const toggleNotif = (key: 'notifBudget' | 'notifMonthly' | 'notifUpload') =>
    patch({ [key]: !s[key] });

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

  // 위젯 표시 토글 (로컬 — 저장 버튼으로 커밋)
  function toggleWidget(id: string) {
    setWidgets((prev) => prev.map((w) => (w.id === id ? { ...w, on: !w.on } : w)));
  }

  // 위젯을 기본값으로 초기화 (로컬)
  function resetWidgets() {
    setWidgets(DEFAULT_WIDGETS.map((w) => ({ ...w })));
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
    notify.success('메뉴 순서를 저장했습니다.');
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
        <div className="bg-background border border-border rounded-[var(--radius-lg)] p-2.5 flex flex-col gap-0.5 sticky top-[calc(var(--header-h)+28px)] shadow-[var(--shadow-sm)] max-md:static max-md:flex-row max-md:flex-wrap">
          {TABS.map((t) => (
            <button key={t.id} type="button" className={`px-3 py-2 rounded-[var(--radius)] text-[0.855rem] cursor-pointer transition-all font-medium text-left ${tab === t.id ? 'bg-accent-dim text-accent font-semibold' : 'text-secondary hover:bg-surface hover:text-primary'}`} onClick={() => setTab(t.id)}>{t.label}</button>
          ))}
        </div>

        <div className="flex flex-col gap-4">
          {/* ── 프로필 ── */}
          {tab === 'profile' && (
            <>
              <Group title="내 계정">
                <div className="flex items-center gap-5 p-5">
                  <div className="w-[60px] h-[60px] rounded-full bg-accent-dim border-2 border-accent flex items-center justify-center [font-family:var(--font-display)] text-[1.4rem] font-extrabold text-accent shrink-0">{(s.displayName || s.user.name || '?').charAt(0)}</div>
                  <div>
                    <div className="font-semibold text-primary text-[0.95rem]">{s.displayName}</div>
                    <div className="text-[0.82rem] text-muted mt-0.5">{s.user.email}</div>
                    <div className="mt-2.5"><Badge tone="success">Google 연결됨</Badge></div>
                  </div>
                </div>
                <Row label="표시 이름" desc="대시보드 상단에 표시되는 이름">
                  <input type="text" className="input w-[180px]" value={displayName} onChange={(e) => setDisplayName(e.target.value)} aria-label="표시 이름" />
                  <Button variant="ghost" onClick={() => patch({ displayName })}>저장</Button>
                </Row>
              </Group>
              <Group title="알림">
                <Row label="예산 초과 알림" desc="카테고리 예산의 80% 이상 소비 시 알림">
                  <Toggle on={s.notifBudget} onToggle={() => toggleNotif('notifBudget')} />
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
            <Group title="월 예산 설정">
              {Object.keys(BUDGET_LABEL).map((code) => (
                <Row key={code} label={BUDGET_LABEL[code]}>
                  <input
                    type="number" className="input w-[140px]"
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
            </Group>
          )}

          {/* ── API 키 ── */}
          {tab === 'api' && (
            <Group title="Claude API">
              <Row label="API 키" desc={s.claudeApiKeySet ? `저장됨 (${s.claudeApiKeyMasked})` : 'AI 리포트 생성에 사용됩니다.'}>
                <input type="password" className="input w-[200px] [font-family:var(--font-mono)]" placeholder={s.claudeApiKeySet ? '변경하려면 입력' : 'sk-ant-api...'} value={apiKeyInput} onChange={(e) => setApiKeyInput(e.target.value)} aria-label="API 키" />
                <Button variant="ghost" onClick={() => patch({ claudeApiKey: apiKeyInput || undefined }).then(() => setApiKeyInput(''))}>저장</Button>
              </Row>
              <Row label="모델" desc="리포트 생성에 사용할 Claude 모델">
                <select className="input w-[200px] [font-family:var(--font-mono)]" aria-label="모델" value={claudeModel} onChange={(e) => { setClaudeModel(e.target.value); patch({ claudeModel: e.target.value }); }}>
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
                        <div className="text-[0.775rem] text-muted mt-0.5">{meta.desc}</div>
                      </div>
                      <Toggle on={w.on} onToggle={() => toggleWidget(w.id)} />
                    </div>
                  );
                })}
              </Group>

              <Group title="위젯 미리보기">
                <div className="grid grid-cols-2 gap-2.5 px-5 py-4">
                  {widgets.map((w) => {
                    const meta = WIDGET_META[w.id];
                    if (!meta) return null;
                    return <div key={w.id} className={`bg-background border border-border rounded-[var(--radius)] px-3 py-2.5 flex items-center gap-2 text-[0.78rem] text-secondary transition-all ${w.on ? '' : 'opacity-35 line-through'}`}>{meta.emoji} {meta.short}</div>;
                  })}
                </div>
                <div className="px-5 pt-3 pb-1 text-[0.82rem] text-muted">실제 구현 시 대시보드에 즉시 반영됩니다.</div>
              </Group>

              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={resetWidgets}>초기화</Button>
                <Button onClick={() => patch({ widgets })}>저장</Button>
              </div>

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
