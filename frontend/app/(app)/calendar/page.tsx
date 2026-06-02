'use client';

/**
 * 캘린더 페이지.
 * 구독 결제·예적금 만기·서류 만료·할일을 월 그리드에 모아 본다.
 * 월 그리드는 Date 계산으로 직접 생성(라이브러리 미사용), 데이터는 API(/calendar)와 연동한다.
 */
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import AppShell from '@/components/AppShell';
import Modal from '@/components/Modal';
import { api } from '@/lib/api';
import {
  EV_TYPE_LABEL, EV_TYPE_OPTIONS, EV_LEGEND, ddLabel,
  type CalEvent, type UpcomingEvent, type EvType,
} from '@/lib/calendar';

const DOW = ['일', '월', '화', '수', '목', '금', '토'];

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
  for (let i = 0; i < firstWeekday; i++) {
    const day = prevDays - firstWeekday + 1 + i;
    cells.push({ key: `p${day}`, day, dim: true });
  }
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push({ key: `c${day}`, day, dim: false, iso: isoOf(year, month, day) });
  }
  const trailing = (7 - ((firstWeekday + daysInMonth) % 7)) % 7;
  for (let day = 1; day <= trailing; day++) {
    cells.push({ key: `n${day}`, day, dim: true });
  }
  return cells;
}

export default function CalendarPage() {
  // 오늘 기준 현재 월로 초기화 (SSR 불일치 방지 — 클라이언트에서 설정)
  const [view, setView] = useState<{ year: number; month: number } | null>(null);
  const [todayIso, setTodayIso] = useState('');
  const [eventsByDate, setEventsByDate] = useState<Record<string, CalEvent[]>>({});
  const [upcoming, setUpcoming] = useState<UpcomingEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [addModal, setAddModal] = useState(false);

  useEffect(() => {
    const now = new Date();
    setTodayIso(isoOf(now.getFullYear(), now.getMonth(), now.getDate()));
    setView({ year: now.getFullYear(), month: now.getMonth() });
  }, []);

  // 현재 view 월의 일정 + 다가오는 일정 조회
  const load = useCallback(async () => {
    if (!view) return;
    const month = `${view.year}-${pad(view.month + 1)}`;
    try {
      const [list, up] = await Promise.all([
        api.get<CalEvent[]>(`/calendar?month=${month}`),
        api.get<UpcomingEvent[]>('/calendar/upcoming'),
      ]);
      const map: Record<string, CalEvent[]> = {};
      for (const ev of list) (map[ev.date] ??= []).push(ev);
      setEventsByDate(map); setUpcoming(up); setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [view]);

  useEffect(() => { load(); }, [load]);

  // 월 이동 (delta: -1 이전, +1 다음)
  function moveMonth(delta: number) {
    setView((v) => {
      if (!v) return v;
      const d = new Date(v.year, v.month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  }

  // 오늘이 속한 달로 이동
  function goToday() {
    const now = new Date();
    setView({ year: now.getFullYear(), month: now.getMonth() });
  }

  const cells = view ? buildMonth(view.year, view.month) : [];

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

      {error && <p className="ledger-note is-error">⚠️ {error}</p>}

      <div className="cal-layout">
        <div>
          {/* 월 이동 툴바 */}
          <div className="cal-toolbar">
            <div className="flex-center gap-2">
              <button type="button" className="btn btn-ghost btn-icon cal-nav-btn" onClick={() => moveMonth(-1)} aria-label="이전 달">‹</button>
              <span className="cal-month-label">{view ? `${view.year}년 ${view.month + 1}월` : ''}</span>
              <button type="button" className="btn btn-ghost btn-icon cal-nav-btn" onClick={() => moveMonth(1)} aria-label="다음 달">›</button>
            </div>
            <button type="button" className="btn btn-ghost btn-sm" onClick={goToday}>오늘</button>
          </div>

          {/* 월 그리드 */}
          <div className="cal-grid">
            {DOW.map((d) => <div key={d} className="cal-dow">{d}</div>)}
            {cells.map((cell) => {
              const events = cell.iso ? eventsByDate[cell.iso] : undefined;
              const isToday = cell.iso === todayIso;
              return (
                <div key={cell.key} className={`cal-cell${cell.dim ? ' dim' : ''}${isToday ? ' today' : ''}`}>
                  <span className="cal-date">{cell.day}</span>
                  {events?.map((ev) => (
                    <span key={ev.id} className={`cal-ev ${ev.type}`}>{ev.title}</span>
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
              {upcoming.length === 0 && <div className="up-item td-muted">다가오는 일정이 없습니다.</div>}
              {upcoming.map((u) => {
                const [, m, d] = u.date.split('-');
                return (
                  <div className="up-item" key={u.id}>
                    <div className="up-date">{Number(m)}/{d}</div>
                    <div className={`up-dot ${u.type}`} />
                    <div>
                      <div className="up-name">{u.title}</div>
                      <div className="up-sub">{EV_TYPE_LABEL[u.type]} · {ddLabel(u.daysUntil)}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="card">
            <div className="card-header"><span className="card-title">범례</span></div>
            <div className="card-body">
              {EV_LEGEND.map((l) => (
                <div className="legend-row" key={l.type}>
                  <span className={`legend-dot ${l.type}`} />{l.label}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 일정 추가 모달 */}
      <AddEventModal open={addModal} onClose={() => setAddModal(false)} onSaved={() => { setAddModal(false); load(); }} />
    </AppShell>
  );
}

// 일정 추가 모달
function AddEventModal({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [type, setType] = useState<EvType>('pay');
  const [memo, setMemo] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // 모달 열릴 때 폼 초기화 (날짜 기본 오늘)
  useEffect(() => {
    if (!open) return;
    setErr(''); setTitle(''); setType('pay'); setMemo('');
    setDate(new Date().toISOString().slice(0, 10));
  }, [open]);

  async function save() {
    if (!title.trim()) { setErr('제목을 입력하세요.'); return; }
    setSaving(true); setErr(null);
    try {
      await api.post('/calendar', { title: title.trim(), date, type, memo: memo || undefined });
      onSaved();
    } catch (x) {
      setErr((x as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="일정 추가"
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>취소</button>
          <button type="button" className="btn btn-primary" onClick={save} disabled={saving}>{saving ? '저장 중...' : '저장'}</button>
        </>
      }
    >
      {err && <p className="input-error">⚠️ {err}</p>}
      <Field label="제목"><input type="text" className="input" placeholder="예: 보험 갱신" value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
      <div className="form-grid-2">
        <Field label="날짜"><input type="date" className="input" aria-label="날짜" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        <Field label="유형">
          <select className="input" aria-label="유형" value={type} onChange={(e) => setType(e.target.value as EvType)}>
            {EV_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </Field>
      </div>
      <Field label="메모 (선택)"><input type="text" className="input" placeholder="추가 메모" value={memo} onChange={(e) => setMemo(e.target.value)} /></Field>
    </Modal>
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
