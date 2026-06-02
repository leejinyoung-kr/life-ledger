'use client';

/**
 * 설정 페이지.
 * 좌측 탭(프로필/예산/카테고리/보안/API키/위젯/데이터)으로 분기하며,
 * 토글·위젯 드래그 정렬·미리보기 동기화를 지원한다. 데이터는 더미. (라이브러리 미사용)
 */
import { useState, type ReactNode } from 'react';
import AppShell from '@/components/AppShell';
import { IconWon, IconBars, IconClock, IconZap, IconLock, IconCube, IconDrag } from '@/components/icons';

type TabId = 'profile' | 'budget' | 'categories' | 'security' | 'api' | 'widgets' | 'data';
const TABS: { id: TabId; label: string }[] = [
  { id: 'profile', label: '프로필' },
  { id: 'budget', label: '예산 설정' },
  { id: 'categories', label: '카테고리' },
  { id: 'security', label: '보안' },
  { id: 'api', label: 'API 키' },
  { id: 'widgets', label: '위젯 설정' },
  { id: 'data', label: '데이터' },
];

interface Widget { id: string; name: string; desc: string; tone: string; icon: ReactNode; emoji: string; short: string; on: boolean; }

// 위젯 기본값 — TODO: GET /api/v1/settings/widgets
const DEFAULT_WIDGETS: Widget[] = [
  { id: 'stat-cards', name: '수입/지출 요약 카드', desc: '이번 달 수입, 지출, 잔액을 한눈에 표시', tone: 'green', icon: <IconWon width={16} height={16} />, emoji: '📊', short: '수입/지출 요약', on: true },
  { id: 'budget-bars', name: '카테고리별 지출 바', desc: '식비, 교통, 구독 등 카테고리별 예산 현황', tone: 'amber', icon: <IconBars width={16} height={16} />, emoji: '📉', short: '카테고리 지출', on: true },
  { id: 'recent-activity', name: '최근 활동', desc: '가계부 추가, 파일 업로드 등 최근 액션 목록', tone: 'blue', icon: <IconClock width={16} height={16} />, emoji: '🕐', short: '최근 활동', on: true },
  { id: 'quick-actions', name: '빠른 실행', desc: '지출 추가, 파일 업로드 등 자주 쓰는 액션 단축', tone: 'muted', icon: <IconZap width={16} height={16} />, emoji: '⚡', short: '빠른 실행', on: true },
  { id: 'cred-count', name: '저장된 계정 수', desc: '계정 보관함 총 개수 및 최근 추가 항목', tone: 'red', icon: <IconLock width={16} height={16} />, emoji: '🔐', short: '계정 수', on: false },
  { id: 'ai-summary', name: 'AI 리포트 요약', desc: '최신 AI 분석 인사이트 한 줄 요약', tone: 'accent', icon: <IconCube width={16} height={16} />, emoji: '🤖', short: 'AI 요약', on: false },
];

const DEFAULT_ON = ['stat-cards', 'budget-bars', 'recent-activity', 'quick-actions'];

// stat-icon 색 클래스로 매핑 (위젯 아이콘 배경)
const toneClass = (tone: string) => (tone === 'muted' || tone === 'accent' ? `widget-icon ${tone}` : `widget-icon stat-icon ${tone}`);

export default function SettingsPage() {
  const [tab, setTab] = useState<TabId>('profile');
  const [widgets, setWidgets] = useState<Widget[]>(DEFAULT_WIDGETS);
  const [dragId, setDragId] = useState<string | null>(null);
  const [categories, setCategories] = useState(['☕ 식비', '🚇 교통', '📺 구독', '🛒 쇼핑', '💰 급여']);
  // 알림 토글 3종
  const [notif, setNotif] = useState({ budget: true, monthly: true, upload: false });

  // 위젯 표시 토글
  function toggleWidget(id: string) {
    setWidgets((prev) => prev.map((w) => (w.id === id ? { ...w, on: !w.on } : w)));
  }

  // 위젯을 기본값(표시 여부·순서)으로 초기화
  function resetWidgets() {
    setWidgets(DEFAULT_WIDGETS.map((w) => ({ ...w, on: DEFAULT_ON.includes(w.id) })));
  }

  // 드래그한 위젯을 대상 위젯 위치로 재배치
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

  // 카테고리 삭제. TODO: DELETE /api/v1/categories/:id
  function removeCategory(c: string) {
    setCategories((prev) => prev.filter((x) => x !== c));
  }

  return (
    <AppShell activePath="/settings" topbarLabel="설정">
      <div className="page-header">
        <h1 className="page-title">설정</h1>
        <p className="page-subtitle">계정, 보안, 예산, 대시보드 위젯 등을 관리합니다.</p>
      </div>

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
                  <div className="avatar-big">K</div>
                  <div>
                    <div className="profile-name">김관리자</div>
                    <div className="profile-email">user@gmail.com</div>
                    <div className="profile-badge"><span className="badge badge-success">Google 연결됨</span></div>
                  </div>
                </div>
                <Row label="표시 이름" desc="대시보드 상단에 표시되는 이름">
                  <input type="text" className="input w-180" defaultValue="김관리자" aria-label="표시 이름" />
                  <button type="button" className="btn btn-ghost">저장</button>
                </Row>
              </Group>
              <Group title="알림">
                <Row label="예산 초과 알림" desc="카테고리 예산의 80% 이상 소비 시 알림">
                  <Toggle on={notif.budget} onToggle={() => setNotif((n) => ({ ...n, budget: !n.budget }))} />
                </Row>
                <Row label="월간 리포트 자동 생성" desc="매월 1일 전월 리포트 자동 생성">
                  <Toggle on={notif.monthly} onToggle={() => setNotif((n) => ({ ...n, monthly: !n.monthly }))} />
                </Row>
                <Row label="파일 업로드 완료 알림" desc="파일 업로드 시 알림 표시">
                  <Toggle on={notif.upload} onToggle={() => setNotif((n) => ({ ...n, upload: !n.upload }))} />
                </Row>
              </Group>
            </>
          )}

          {/* ── 예산 설정 ── */}
          {tab === 'budget' && (
            <Group title="월 예산 설정">
              {[['식비', 400000], ['교통', 150000], ['구독', 200000], ['쇼핑', 300000], ['기타', 150000]].map(([label, val]) => (
                <Row key={label as string} label={label as string}>
                  <input type="number" className="input w-140" defaultValue={val as number} aria-label={`${label} 예산`} />
                  <span className="text-muted">원</span>
                </Row>
              ))}
              <div className="settings-row end">
                <button type="button" className="btn btn-primary">저장</button>
              </div>
            </Group>
          )}

          {/* ── 카테고리 ── */}
          {tab === 'categories' && (
            <Group title="카테고리 관리">
              {categories.map((c) => (
                <Row key={c} label={c}>
                  <button type="button" className="btn btn-danger" onClick={() => removeCategory(c)}>삭제</button>
                </Row>
              ))}
              <div className="settings-row add">
                <input type="text" className="input w-180" placeholder="새 카테고리명" aria-label="새 카테고리명" />
                <input type="text" className="input w-70" placeholder="이모지" aria-label="이모지" />
                <button type="button" className="btn btn-primary">추가</button>
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
                <select className="input w-auto" aria-label="세션 자동 만료"><option>7일</option><option>1일</option><option>12시간</option><option>없음</option></select>
              </Row>
              <Row label="비밀번호 자동 숨김" desc="계정 상세 모달에서 PW 표시 후 자동 숨김 시간">
                <select className="input w-auto" aria-label="비밀번호 자동 숨김"><option>10초</option><option>30초</option><option>1분</option><option>없음</option></select>
              </Row>
            </Group>
          )}

          {/* ── API 키 ── */}
          {tab === 'api' && (
            <Group title="Claude API">
              <Row label="API 키" desc="AI 리포트 생성에 사용됩니다.">
                <input type="password" className="input w-200 input-mono" defaultValue="sk-ant-api..." aria-label="API 키" />
                <button type="button" className="btn btn-ghost">저장</button>
              </Row>
              <Row label="모델" desc="리포트 생성에 사용할 Claude 모델">
                <select className="input w-200 input-mono" aria-label="모델"><option>claude-sonnet-4-6</option><option>claude-haiku-4-5</option></select>
              </Row>
            </Group>
          )}

          {/* ── 위젯 설정 ── */}
          {tab === 'widgets' && (
            <>
              <Group title="대시보드 위젯 표시 설정">
                <p className="settings-note">표시할 위젯을 켜고 끌 수 있습니다. 드래그로 순서를 변경하세요.</p>
                {widgets.map((w) => (
                  <div
                    key={w.id}
                    className="widget-item"
                    draggable
                    onDragStart={() => setDragId(w.id)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => onDrop(w.id)}
                  >
                    <span className="widget-drag-handle"><IconDrag width={14} height={14} /></span>
                    <div className={toneClass(w.tone)}>{w.icon}</div>
                    <div className="widget-info">
                      <div className="widget-name">{w.name}</div>
                      <div className="widget-desc">{w.desc}</div>
                    </div>
                    <Toggle on={w.on} onToggle={() => toggleWidget(w.id)} />
                  </div>
                ))}
              </Group>

              <Group title="위젯 미리보기">
                <div className="widget-preview">
                  {widgets.map((w) => (
                    <div key={w.id} className={`widget-preview-card${w.on ? '' : ' off'}`}>{w.emoji} {w.short}</div>
                  ))}
                </div>
                <div className="settings-note">실제 구현 시 대시보드에 즉시 반영됩니다.</div>
              </Group>

              <div className="settings-actions">
                <button type="button" className="btn btn-ghost" onClick={resetWidgets}>초기화</button>
                {/* TODO: 위젯 설정 저장 API 연동 */}
                <button type="button" className="btn btn-primary">저장</button>
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
    <button type="button" className={`toggle${on ? ' on' : ''}`} onClick={onToggle} aria-pressed={on} aria-label="토글" />
  );
}
