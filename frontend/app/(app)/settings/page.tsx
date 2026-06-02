'use client';

/**
 * 설정 페이지.
 * 좌측 탭(프로필/예산/카테고리/보안/API키/위젯/데이터)으로 분기하며,
 * 토글·위젯 드래그 정렬을 지원한다. 데이터는 백엔드 API(/settings)와 연동한다.
 */
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import AppShell from '@/components/AppShell';
import { IconWon, IconBars, IconClock, IconZap, IconLock, IconCube, IconDrag } from '@/components/icons';
import { api } from '@/lib/api';
import {
  BUDGET_LABEL, SESSION_EXPIRY_OPTIONS, PW_AUTO_HIDE_OPTIONS, CLAUDE_MODEL_OPTIONS,
  type Settings, type Category, type WidgetPref,
} from '@/lib/settings';

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

// stat-icon 색 클래스로 매핑 (위젯 아이콘 배경)
const toneClass = (tone: string) => (tone === 'muted' || tone === 'accent' ? `widget-icon ${tone}` : `widget-icon stat-icon ${tone}`);

export default function SettingsPage() {
  const [tab, setTab] = useState<TabId>('profile');
  const [s, setS] = useState<Settings | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 로컬 편집 상태 (입력 중 값 — 저장 버튼으로 커밋)
  const [displayName, setDisplayName] = useState('');
  const [budgets, setBudgets] = useState<Record<string, number>>({});
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [claudeModel, setClaudeModel] = useState('claude-sonnet-4-6');
  const [newCatName, setNewCatName] = useState('');
  const [newCatEmoji, setNewCatEmoji] = useState('');
  const [widgets, setWidgets] = useState<WidgetPref[]>(DEFAULT_WIDGETS);
  const [dragId, setDragId] = useState<string | null>(null);

  // 설정 조회 후 로컬 상태 초기화
  const load = useCallback(async () => {
    try {
      const data = await api.get<Settings>('/settings');
      setS(data);
      setDisplayName(data.displayName);
      setBudgets(data.budgets);
      setClaudeModel(data.claudeModel);
      setWidgets(data.widgets.length ? data.widgets : DEFAULT_WIDGETS);
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
        <div className="page-header"><h1 className="page-title">설정</h1></div>
        {error ? <p className="ledger-note is-error">⚠️ {error}</p> : <p className="muted-note">불러오는 중...</p>}
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

  return (
    <AppShell activePath="/settings" topbarLabel="설정">
      <div className="page-header">
        <div>
          <h1 className="page-title">설정</h1>
          <p className="page-subtitle">계정, 보안, 예산, 대시보드 위젯 등을 관리합니다.</p>
        </div>
      </div>

      {error && <p className="ledger-note is-error">⚠️ {error}</p>}

      <div className="settings-layout">
        {/* 탭 네비 */}
        <div className="settings-nav">
          {TABS.map((t) => (
            <button key={t.id} type="button" className={`s-nav-item${tab === t.id ? ' active' : ''}`} onClick={() => setTab(t.id)}>{t.label}</button>
          ))}
        </div>

        <div className="settings-section">
          {/* ── 프로필 ── */}
          {tab === 'profile' && (
            <>
              <Group title="내 계정">
                <div className="profile-area">
                  <div className="avatar-big">{(s.displayName || s.user.name || '?').charAt(0)}</div>
                  <div>
                    <div className="profile-name">{s.displayName}</div>
                    <div className="profile-email">{s.user.email}</div>
                    <div className="profile-badge"><span className="badge badge-success">Google 연결됨</span></div>
                  </div>
                </div>
                <Row label="표시 이름" desc="대시보드 상단에 표시되는 이름">
                  <input type="text" className="input w-180" value={displayName} onChange={(e) => setDisplayName(e.target.value)} aria-label="표시 이름" />
                  <button type="button" className="btn btn-ghost" onClick={() => patch({ displayName })}>저장</button>
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
                    type="number" className="input w-140"
                    value={budgets[code] ?? 0}
                    onChange={(e) => setBudgets((b) => ({ ...b, [code]: Number(e.target.value) }))}
                    aria-label={`${BUDGET_LABEL[code]} 예산`}
                  />
                  <span className="text-muted">원</span>
                </Row>
              ))}
              <div className="settings-row end">
                <button type="button" className="btn btn-primary" onClick={() => patch({ budgets })}>저장</button>
              </div>
            </Group>
          )}


          {/* ── 보안 ── */}
          {tab === 'security' && (
            <Group title="암호화 설정">
              <Row label="암호화 방식" desc="계정 보관함 비밀번호 암호화 알고리즘">
                <span className="badge badge-success">AES-256-GCM</span>
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
                <input type="password" className="input w-200 input-mono" placeholder={s.claudeApiKeySet ? '변경하려면 입력' : 'sk-ant-api...'} value={apiKeyInput} onChange={(e) => setApiKeyInput(e.target.value)} aria-label="API 키" />
                <button type="button" className="btn btn-ghost" onClick={() => patch({ claudeApiKey: apiKeyInput || undefined }).then(() => setApiKeyInput(''))}>저장</button>
              </Row>
              <Row label="모델" desc="리포트 생성에 사용할 Claude 모델">
                <select className="input w-200 input-mono" aria-label="모델" value={claudeModel} onChange={(e) => { setClaudeModel(e.target.value); patch({ claudeModel: e.target.value }); }}>
                  {CLAUDE_MODEL_OPTIONS.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </Row>
            </Group>
          )}

          {/* ── 위젯 설정 ── */}
          {tab === 'widgets' && (
            <>
              <Group title="대시보드 위젯 표시 설정">
                <p className="settings-note">표시할 위젯을 켜고 끌 수 있습니다. 드래그로 순서를 변경하세요.</p>
                {widgets.map((w) => {
                  const meta = WIDGET_META[w.id];
                  if (!meta) return null;
                  return (
                    <div
                      key={w.id}
                      className="widget-item"
                      draggable
                      onDragStart={() => setDragId(w.id)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => onDrop(w.id)}
                    >
                      <span className="widget-drag-handle"><IconDrag width={14} height={14} /></span>
                      <div className={toneClass(meta.tone)}>{meta.icon}</div>
                      <div className="widget-info">
                        <div className="widget-name">{meta.name}</div>
                        <div className="widget-desc">{meta.desc}</div>
                      </div>
                      <Toggle on={w.on} onToggle={() => toggleWidget(w.id)} />
                    </div>
                  );
                })}
              </Group>

              <Group title="위젯 미리보기">
                <div className="widget-preview">
                  {widgets.map((w) => {
                    const meta = WIDGET_META[w.id];
                    if (!meta) return null;
                    return <div key={w.id} className={`widget-preview-card${w.on ? '' : ' off'}`}>{meta.emoji} {meta.short}</div>;
                  })}
                </div>
                <div className="settings-note">실제 구현 시 대시보드에 즉시 반영됩니다.</div>
              </Group>

              <div className="settings-actions">
                <button type="button" className="btn btn-ghost" onClick={resetWidgets}>초기화</button>
                <button type="button" className="btn btn-primary" onClick={() => patch({ widgets })}>저장</button>
              </div>
            </>
          )}

          {/* ── 데이터 ── */}
          {tab === 'data' && (
            <>
              <Group title="데이터 내보내기">
                <Row label="가계부 데이터" desc="전체 거래 내역을 CSV로 다운로드">
                  <button type="button" className="btn btn-ghost">CSV 다운로드</button>
                </Row>
                <Row label="계정 보관함" desc="암호화된 JSON 형태로 백업">
                  <button type="button" className="btn btn-ghost">JSON 백업</button>
                </Row>
                <Row label="메모" desc="전체 메모를 마크다운 ZIP으로 다운로드">
                  <button type="button" className="btn btn-ghost">ZIP 다운로드</button>
                </Row>
              </Group>
              <div className="settings-group danger-group">
                <div className="settings-group-header">위험 구역</div>
                <Row labelClass="danger" label="계정 삭제" desc="모든 데이터가 영구 삭제됩니다. 되돌릴 수 없습니다.">
                  {/* TODO: 계정 삭제 API 연동 (확인 절차 필수) */}
                  <button type="button" className="btn btn-danger">계정 삭제</button>
                </Row>
              </div>
            </>
          )}
        </div>
      </div>
    </AppShell>
  );
}

// 설정 그룹 (헤더 + 행 묶음)
function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="settings-group">
      <div className="settings-group-header">{title}</div>
      {children}
    </div>
  );
}

// 설정 행 (라벨/설명 + 우측 컨트롤)
function Row({ label, desc, labelClass, children }: { label: string; desc?: string; labelClass?: string; children: ReactNode }) {
  return (
    <div className="settings-row">
      <div>
        <div className={`row-label${labelClass ? ` ${labelClass}` : ''}`}>{label}</div>
        {desc && <div className="row-desc">{desc}</div>}
      </div>
      <div className="row-ctrl">{children}</div>
    </div>
  );
}

// 토글 스위치 (controlled)
function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button type="button" className={`toggle${on ? ' on' : ''}`} onClick={onToggle} aria-pressed={on ? 'true' : 'false'} aria-label="토글" />
  );
}

