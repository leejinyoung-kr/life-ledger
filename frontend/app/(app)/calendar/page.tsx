'use client';

/**
 * 캘린더 페이지.
 * 구독 결제·예적금 만기·서류 만료·할일을 월 그리드에 모아 본다.
 * 월 그리드는 Date 계산으로 직접 생성(라이브러리 미사용), 데이터는 더미로 채운다.
 */
import { useEffect, useState, type ReactNode } from 'react';
import AppShell from '@/components/AppShell';
import Modal from '@/components/Modal';

type EvType = 'pay' | 'due' | 'exp' | 'task';
interface CalEvent { text: string; type: EvType; }

const DOW = ['일', '월', '화', '수', '목', '금', '토'];

// ── 더미 데이터 (TODO: GET /api/v1/calendar?month=) ─────────────
// 날짜(YYYY-MM-DD) → 이벤트 목록
const EVENTS: Record<string, CalEvent[]> = {
  '2025-06-03': [{ text: '유튜브 ₩14,900', type: 'pay' }, { text: 'Disney+ 체험종료', type: 'exp' }],
  '2025-06-04': [{ text: 'Disney+ ₩9,900', type: 'pay' }],
  '2025-06-07': [{ text: '여권 D-58 알림', type: 'exp' }],
  '2025-06-10': [{ text: 'iCloud ₩3,300', type: 'pay' }],
  '2025-06-12': [{ text: 'ChatGPT $20', type: 'pay' }],
  '2025-06-14': [{ text: '보험갱신', type: 'task' }],
  '2025-06-15': [{ text: '스포티파이 ₩10,900', type: 'pay' }],
  '2025-06-20': [{ text: '쿠팡와우 ₩7,890', type: 'pay' }],
  '2025-06-25': [{ text: '월급 입금', type: 'due' }],
  '2025-06-29': [{ text: '넷플릭스 ₩17,000', type: 'pay' }],
};

// 다가오는 일정 — TODO: GET /api/v1/calendar/upcoming
const UPCOMING = [
  { date: '6/03', type: 'pay' as EvType, name: '유튜브 프리미엄 결제', sub: '₩14,900 · D-2' },
  { date: '6/04', type: 'exp' as EvType, name: 'Disney+ 체험 종료', sub: '자동결제 전환 · D-3' },
  { date: '6/14', type: 'task' as EvType, name: '자동차 보험 갱신', sub: '할일 · D-13' },
  { date: '6/25', type: 'due' as EvType, name: '월급 입금', sub: '₩3,200,000 · D-24' },
];

const LEGEND: { type: EvType; label: string }[] = [
  { type: 'pay', label: '구독 결제' },
  { type: 'due', label: '입금 / 만기' },
  { type: 'exp', label: '서류 만료' },
  { type: 'task', label: '할일' },
];

// 2자리 0 패딩
const pad = (n: number) => String(n).padStart(2, '0');
const isoOf = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;

interface Cell { key: string; day: number; dim: boolean; iso?: string; }

// 해당 연·월의 6주 그리드 셀 배열 생성 (앞뒤 달 dim 채움)
function buildMonth(year: number, month: number): Cell[] {
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prevDays = new Date(year, month, 0).getDate();
  const cells: Cell[] = [];
  // 앞쪽 — 이전 달 말일들
  for (let i = 0; i < firstWeekday; i++) {
    const day = prevDays - firstWeekday + 1 + i;
    cells.push({ key: `p${day}`, day, dim: true });
  }
  // 이번 달
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push({ key: `c${day}`, day, dim: false, iso: isoOf(year, month, day) });
  }
  // 뒤쪽 — 다음 달 초입 (주 단위로 채움)
  const trailing = (7 - ((firstWeekday + daysInMonth) % 7)) % 7;
  for (let day = 1; day <= trailing; day++) {
    cells.push({ key: `n${day}`, day, dim: true });
  }
  return cells;
}

export default function CalendarPage() {
  // 더미 이벤트가 있는 2025년 6월로 초기화 (month 0-indexed)
  const [view, setView] = useState({ year: 2025, month: 5 });
  const [todayIso, setTodayIso] = useState('');
  const [addModal, setAddModal] = useState(false);

  // 오늘 날짜는 클라이언트에서만 계산 (SSR 불일치 방지)
  useEffect(() => {
    const now = new Date();
    setTodayIso(isoOf(now.getFullYear(), now.getMonth(), now.getDate()));
  }, []);

  // 월 이동 (delta: -1 이전, +1 다음)
  function moveMonth(delta: number) {
    setView((v) => {
      const d = new Date(v.year, v.month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  }

  // 오늘이 속한 달로 이동
  function goToday() {
    const now = new Date();
    setView({ year: now.getFullYear(), month: now.getMonth() });
  }

  const cells = buildMonth(view.year, view.month);

  return (
    <AppShell
      activePath="/calendar"
      topbarLabel="캘린더"
      actionLabel="일정 추가"
      onAction={() => setAddModal(true)}
    >
      <div className="page-header">
        <h1 className="page-title">캘린더</h1>
        <p className="page-subtitle">구독 결제·예적금 만기·서류 만료·할일을 한 곳에서 봅니다.</p>
      </div>

      <div className="cal-layout">
        <div>
          {/* 월 이동 툴바 */}
          <div className="cal-toolbar">
            <div className="flex-center gap-2">
              <button type="button" className="btn btn-ghost btn-icon cal-nav-btn" onClick={() => moveMonth(-1)} aria-label="이전 달">‹</button>
              <span className="cal-month-label">{view.year}년 {view.month + 1}월</span>
              <button type="button" className="btn btn-ghost btn-icon cal-nav-btn" onClick={() => moveMonth(1)} aria-label="다음 달">›</button>
            </div>
            <button type="button" className="btn btn-ghost btn-sm" onClick={goToday}>오늘</button>
          </div>

          {/* 월 그리드 */}
          <div className="cal-grid">
            {DOW.map((d) => <div key={d} className="cal-dow">{d}</div>)}
            {cells.map((cell) => {
              const events = cell.iso ? EVENTS[cell.iso] : undefined;
              const isToday = cell.iso === todayIso;
              return (
                <div key={cell.key} className={`cal-cell${cell.dim ? ' dim' : ''}${isToday ? ' today' : ''}`}>
                  <span className="cal-date">{cell.day}</span>
                  {events?.map((ev, i) => (
                    <span key={i} className={`cal-ev ${ev.type}`}>{ev.text}</span>
                  ))}
                </div>
              );
            })}
          </div>
        </div>

        {/* 우측 — 다가오는 일정 + 범례 */}
        <div className="cal-side">
          <div className="card">
            <div className="card-header"><span className="card-title">다가오는 일정</span></div>
            <div className="card-body compact">
              {UPCOMING.map((u) => (
                <div className="up-item" key={u.name}>
                  <div className="up-date">{u.date}</div>
                  <div className={`up-dot ${u.type}`} />
                  <div>
                    <div className="up-name">{u.name}</div>
                    <div className="up-sub">{u.sub}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="card-header"><span className="card-title">범례</span></div>
            <div className="card-body">
              {LEGEND.map((l) => (
                <div className="legend-row" key={l.type}>
                  <span className={`legend-dot ${l.type}`} />{l.label}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 일정 추가 모달 */}
      <Modal
        open={addModal}
        onClose={() => setAddModal(false)}
        title="일정 추가"
        footer={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setAddModal(false)}>취소</button>
            {/* TODO: API 연동 — 저장(POST) 처리 */}
            <button type="button" className="btn btn-primary">저장</button>
          </>
        }
      >
        <Field label="제목"><input type="text" className="input" placeholder="예: 보험 갱신" /></Field>
        <div className="form-grid-2">
          <Field label="날짜"><input type="date" className="input" /></Field>
          <Field label="유형">
            <select className="input" aria-label="유형">
              <option>구독 결제</option><option>입금 / 만기</option><option>서류 만료</option><option>할일</option>
            </select>
          </Field>
        </div>
        <Field label="메모 (선택)"><input type="text" className="input" placeholder="추가 메모" /></Field>
      </Modal>
    </AppShell>
  );
}

// 입력 그룹 (라벨 + 입력요소). label 로 감싸 입력요소에 접근성 이름을 연결한다.
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="input-group">
      <span className="input-label">{label}</span>
      {children}
    </label>
  );
}
