'use client';

/**
 * 캘린더 페이지.
 * 구독 결제·예적금 만기·서류 만료·할일을 월 그리드에 모아 본다.
 * 월 그리드는 Date 계산으로 직접 생성(라이브러리 미사용), 데이터는 API(/calendar)와 연동한다.
 * 스타일: Tailwind + 공통 컴포넌트(Card/Button/Field).
 */
import { useEffect, useMemo, useState } from 'react';
import { IconTrash } from '@/components/icons';
import { notify } from '@/lib/toast';
import { withEulReul } from '@/lib/korean';
import { useApiQuery, useInvalidate } from '@/lib/query';
import { useFormErrors } from '@/lib/useFormErrors';
import { qk } from '@/lib/queryKeys';
import AppShell from '@/components/AppShell';
import ErrorBanner from '@/components/ErrorBanner';
import EmptyState from '@/components/EmptyState';
import Modal from '@/components/Modal';
import Button from '@/components/ui/Button';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card';
import { Field, ModalFooter } from '@/components/ui/Field';
import { useConfirm } from '@/components/ConfirmModal';
import { api } from '@/lib/api';
import {
  EV_TYPE_LABEL, EV_TYPE_OPTIONS, EV_LEGEND, VIRT_SOURCE_META, ddLabel,
  type CalEvent, type UpcomingEvent, type EvType,
} from '@/lib/calendar';

const DOW = ['일', '월', '화', '수', '목', '금', '토'];

// 일정 유형별 색 (그리드 칩 / 점)
const EV_BG: Record<EvType, string> = {
  pay: 'bg-danger-dim text-danger', due: 'bg-blue-dim text-blue', exp: 'bg-warning-dim text-warning', task: 'bg-accent-dim text-accent',
};
const DOT_BG: Record<EvType, string> = {
  pay: 'bg-danger', due: 'bg-blue', exp: 'bg-warning', task: 'bg-accent',
};

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
  const [addModal, setAddModal] = useState(false);
  const [detailEvent, setDetailEvent] = useState<CalEvent | null>(null);
  const { confirm, confirmElement } = useConfirm();
  const invalidate = useInvalidate();

  useEffect(() => {
    const now = new Date();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 클라이언트 마운트 시점의 오늘 날짜로 초기화 (SSR과 클라이언트 시각 불일치 방지)
    setTodayIso(isoOf(now.getFullYear(), now.getMonth(), now.getDate()));
    setView({ year: now.getFullYear(), month: now.getMonth() });
  }, []);

  // 현재 view 월의 일정 + 다가오는 일정 (React Query 캐시)
  const month = view ? `${view.year}-${pad(view.month + 1)}` : null;
  const eventsQuery = useApiQuery<CalEvent[]>(qk.calendar.list(month ?? undefined), `/calendar?month=${month}`, { enabled: !!month });
  const upcomingQuery = useApiQuery<UpcomingEvent[]>(['calendar', 'upcoming'], '/calendar/upcoming');
  const eventsByDate = useMemo(() => {
    const map: Record<string, CalEvent[]> = {};
    for (const ev of eventsQuery.data ?? []) (map[ev.date] ??= []).push(ev);
    return map;
  }, [eventsQuery.data]);
  const upcoming = upcomingQuery.data ?? [];
  const error = (eventsQuery.error ?? upcomingQuery.error)?.message ?? null;
  const reload = () => invalidate(qk.calendar.all);

  // 월 이동 (delta: -1 이전, +1 다음)
  function moveMonth(delta: number) {
    setView((v) => {
      if (!v) return v;
      const d = new Date(v.year, v.month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  }

  // 일정 삭제 (가상 이벤트면 원본 테이블에서도 삭제)
  async function removeEvent(ev: CalEvent) {
    const label = ev.virtual && ev.sourceType ? `${VIRT_SOURCE_META[ev.sourceType].label} 항목` : '일정';
    const msg = ev.virtual
      ? `이 ${withEulReul(label)} 삭제할까요? 해당 페이지에서도 삭제됩니다.`
      : '이 일정을 삭제할까요?';
    if (!await confirm(msg, 'danger')) return;
    try {
      await api.del(`/calendar/${ev.id}`);
      notify.deleted(label);
      setDetailEvent(null);
      reload();
    } catch {
      notify.deleteFailed();
    }
  }

  // 오늘이 속한 달로 이동
  function goToday() {
    const now = new Date();
    setView({ year: now.getFullYear(), month: now.getMonth() });
  }

  const cells = view ? buildMonth(view.year, view.month) : [];
  const navBtn = 'w-[34px] h-[34px] inline-flex items-center justify-center rounded-[var(--radius)] text-[1.1rem] leading-none text-secondary border border-border transition-all hover:bg-surface hover:text-primary';

  return (
    <AppShell activePath="/calendar" topbarLabel="캘린더">
      <div className="mb-7">
        <div className="flex items-center justify-between gap-4">
          <h1 className="[font-family:var(--font-display)] text-[1.55rem] font-bold tracking-[-0.03em] text-primary">캘린더</h1>
          <Button onClick={() => setAddModal(true)}>일정 추가</Button>
        </div>
        <p className="text-sm text-secondary mt-1.5 break-keep">구독 결제·예적금 만기·서류 만료·할일을 한 곳에서 봅니다.</p>
      </div>

      <p className="text-[0.8rem] text-muted bg-surface border border-border-subtle rounded-(--radius) px-3.5 py-2 mb-5">
        ◈ 표시 항목(구독·예적금·신원지갑·할일)은 연동된 데이터입니다. 수정은 각 페이지에서, 삭제 시 원본에서도 삭제됩니다.
      </p>

      <ErrorBanner message={error} />

      <div className="grid grid-cols-1 min-[900px]:grid-cols-[1fr_300px] gap-5 items-start">
        <div>
          {/* 월 이동 툴바 */}
          <div className="flex items-center justify-between mb-3.5">
            <div className="flex items-center gap-2">
              <button type="button" className={navBtn} onClick={() => moveMonth(-1)} aria-label="이전 달">‹</button>
              <span className="[font-family:var(--font-display)] font-bold text-[1.1rem]">{view ? `${view.year}년 ${view.month + 1}월` : ''}</span>
              <button type="button" className={navBtn} onClick={() => moveMonth(1)} aria-label="다음 달">›</button>
            </div>
            <Button variant="ghost" size="sm" onClick={goToday}>오늘</Button>
          </div>

          {/* 월 그리드 */}
          <div className="grid grid-cols-7 bg-border gap-px border border-border rounded-[var(--radius-lg)] overflow-hidden">
            {DOW.map((d) => <div key={d} className="bg-surface p-2 text-center text-[0.7rem] font-semibold text-muted uppercase">{d}</div>)}
            {cells.map((cell) => {
              const events = cell.iso ? eventsByDate[cell.iso] : undefined;
              const isToday = cell.iso === todayIso;
              return (
                <div key={cell.key} className={`min-h-[92px] max-md:min-h-[64px] p-1.5 flex flex-col gap-[3px] ${cell.dim ? 'bg-surface text-muted' : 'bg-background'}`}>
                  <span className={isToday ? 'bg-accent text-white w-[22px] h-[22px] rounded-full flex items-center justify-center text-[0.78rem] font-semibold' : 'text-[0.78rem] font-semibold text-secondary'}>{cell.day}</span>
                  {events?.map((ev) => (
                    <span
                      key={ev.id}
                      className={`text-[0.65rem] px-1.25 py-px rounded-sm whitespace-nowrap overflow-hidden text-ellipsis cursor-pointer hover:opacity-75 transition-opacity ${EV_BG[ev.type]} ${ev.virtual ? 'opacity-75 border border-current border-dashed' : ''}`}
                      onClick={() => setDetailEvent(ev)}
                    >
                      {ev.virtual ? '◈ ' : ''}{ev.title}
                    </span>
                  ))}
                </div>
              );
            })}
          </div>
        </div>

        {/* 우측 — 다가오는 일정 + 범례 */}
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader><CardTitle>다가오는 일정</CardTitle></CardHeader>
            <CardBody compact>
              {upcoming.length === 0 && <EmptyState message="다가오는 일정이 없습니다." className="py-2.5 text-muted text-[0.84rem]" />}
              {upcoming.map((u) => {
                const [, m, d] = u.date.split('-');
                return (
                  <div className="flex gap-2.5 py-2.5 border-b border-border-subtle last:border-b-0 items-center" key={u.id}>
                    <div className="[font-family:var(--font-display)] font-bold text-[0.78rem] text-primary w-[42px] shrink-0 text-center">{Number(m)}/{d}</div>
                    <div className={`w-2 h-2 rounded-full shrink-0 ${DOT_BG[u.type]}`} />
                    <div className="flex-1">
                      <div className="text-[0.84rem] font-medium">{u.title}</div>
                      <div className="text-[0.72rem] text-muted">{EV_TYPE_LABEL[u.type]} · {ddLabel(u.daysUntil)}</div>
                    </div>
                    <button
                      type="button"
                      className="icon-btn-danger"
                      onClick={() => removeEvent(u)}
                      aria-label="일정 삭제"
                    ><IconTrash width={12} height={12} /></button>
                  </div>
                );
              })}
            </CardBody>
          </Card>

          <Card>
            <CardHeader><CardTitle>범례</CardTitle></CardHeader>
            <CardBody>
              {EV_LEGEND.map((l) => (
                <div className="flex items-center gap-2 text-[0.78rem] mb-1.5 last:mb-0" key={l.type}>
                  <span className={`w-2.5 h-2.5 rounded-[3px] ${DOT_BG[l.type]}`} />{l.label}
                </div>
              ))}
            </CardBody>
          </Card>
        </div>
      </div>

      {/* 일정 추가 모달 */}
      <AddEventModal open={addModal} onClose={() => setAddModal(false)} onSaved={() => { setAddModal(false); reload(); }} />

      {/* 일정 상세/삭제 모달 */}
      <EventDetailModal event={detailEvent} onClose={() => setDetailEvent(null)} onDelete={(ev) => removeEvent(ev)} />

      {confirmElement}
    </AppShell>
  );
}

// 일정 상세 / 삭제 모달
function EventDetailModal({ event, onClose, onDelete }: { event: CalEvent | null; onClose: () => void; onDelete: (ev: CalEvent) => void }) {
  if (!event) return null;
  const [, m, d] = event.date.split('-');
  const sourceMeta = event.virtual && event.sourceType ? VIRT_SOURCE_META[event.sourceType] : null;
  return (
    <Modal open={!!event} onClose={onClose} title="일정 상세">
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-[0.75rem] px-2 py-0.5 rounded-sm ${EV_BG[event.type]}`}>{EV_TYPE_LABEL[event.type]}</span>
          {sourceMeta && <span className="text-[0.72rem] px-2 py-0.5 rounded-sm bg-surface border border-border-subtle text-muted">◈ {sourceMeta.label} 연동</span>}
          <span className="text-[0.84rem] text-secondary">{Number(m)}월 {d}일</span>
        </div>
        <p className="text-[1rem] font-semibold text-primary">{event.title}</p>
        {event.memo && <p className="text-[0.875rem] text-secondary bg-surface border border-border-subtle rounded-(--radius) px-3 py-2">{event.memo}</p>}
      </div>
      <div className="flex justify-between mt-5">
        <Button variant="danger" size="sm" onClick={() => onDelete(event)}>삭제</Button>
        <Button variant="ghost" size="sm" onClick={onClose}>닫기</Button>
      </div>
    </Modal>
  );
}

// 일정 추가 모달
function AddEventModal({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [type, setType] = useState<EvType>('pay');
  const [memo, setMemo] = useState('');
  const [saving, setSaving] = useState(false);
  const { errors, setErrors, clearError, reset } = useFormErrors();

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 모달 열릴 때 폼 초기화
    reset(); setTitle(''); setType('pay'); setMemo('');
    setDate(new Date().toISOString().slice(0, 10));
  }, [open]);

  function validate() {
    const err: Record<string, string> = {};
    if (!title.trim()) err.title = '제목을 입력하세요.';
    if (!date) err.date = '날짜를 선택하세요.';
    setErrors(err);
    return !Object.keys(err).length;
  }

  async function save() {
    if (!validate()) return;
    setSaving(true);
    try {
      await api.post('/calendar', { title: title.trim(), date, type, memo: memo || undefined });
      notify.added('일정');
      onSaved();
    } catch {
      notify.saveFailed();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="일정 추가" footer={<ModalFooter onClose={onClose} onSave={save} saving={saving} />}>
      <Field label="제목" required error={errors.title}>
        <input type="text" className={`input${errors.title ? ' is-invalid' : ''}`} placeholder="예: 보험 갱신" value={title} onChange={(e) => { setTitle(e.target.value); clearError('title'); }} />
      </Field>
      <div className="grid grid-cols-2 gap-4 max-md:grid-cols-1">
        <Field label="날짜" required error={errors.date}>
          <input type="date" className={`input${errors.date ? ' is-invalid' : ''}`} aria-label="날짜" value={date} onChange={(e) => { setDate(e.target.value); clearError('date'); }} />
        </Field>
        <Field label="유형" required>
          <select className="input" aria-label="유형" value={type} onChange={(e) => setType(e.target.value as EvType)}>
            {EV_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </Field>
      </div>
      <Field label="메모 (선택)"><input type="text" className="input" placeholder="추가 메모" value={memo} onChange={(e) => setMemo(e.target.value)} /></Field>
    </Modal>
  );
}
