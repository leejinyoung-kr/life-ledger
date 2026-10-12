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
import PageHeader from '@/components/PageHeader';
import ErrorBanner from '@/components/ErrorBanner';
import EmptyState from '@/components/EmptyState';
import Modal from '@/components/Modal';
import Button from '@/components/ui/Button';
import IconButton from '@/components/ui/IconButton';
import Toggle from '@/components/ui/Toggle';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card';
import { Field, ModalFooter } from '@/components/ui/Field';
import { useConfirm } from '@/components/ConfirmModal';
import { api } from '@/lib/api';
import type { Settings } from '@/lib/settings';
import { localDate } from '@/lib/finance';
import {
  EV_TYPE_LABEL, EV_TYPE_OPTIONS, EV_LEGEND, VIRT_SOURCE_META, ddLabel,
  RECUR_FREQ_LABEL, RECUR_FREQ_OPTIONS, LUNAR_RECUR_FREQ_OPTIONS,
  type CalEvent, type UpcomingEvent, type EvType, type RecurFreq,
} from '@/lib/calendar';

const DOW = ['일', '월', '화', '수', '목', '금', '토'];

// 일정 유형별 색 (그리드 칩 / 점) — 공휴일은 전통적인 빨간 표기 관례에 따라 구독 결제와 동일한 danger 톤 재사용
const EV_BG: Record<EvType, string> = {
  pay: 'bg-danger-dim text-danger', due: 'bg-blue-dim text-blue', exp: 'bg-warning-dim text-warning', task: 'bg-accent-dim text-accent', holiday: 'bg-danger-dim text-danger',
};
const DOT_BG: Record<EvType, string> = {
  pay: 'bg-danger', due: 'bg-blue', exp: 'bg-warning', task: 'bg-accent', holiday: 'bg-danger',
};

// 2자리 0 패딩
const pad = (n: number) => String(n).padStart(2, '0');
const isoOf = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;

// 연도 선택 옵션 (현재 연도 기준 -10 ~ +10)
const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 21 }, (_, i) => CURRENT_YEAR - 10 + i);
const MONTH_OPTIONS = Array.from({ length: 12 }, (_, i) => i);

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
  const [addModal, setAddModal] = useState<{ open: boolean; date?: string }>({ open: false });
  const [detailEvent, setDetailEvent] = useState<CalEvent | null>(null);
  // 모바일 — 날짜 점(dot) 탭 시 그 날 일정 목록 모달
  const [dayList, setDayList] = useState<{ day: number; events: CalEvent[] } | null>(null);
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
  const settingsQuery = useApiQuery<Settings>(qk.settings.detail(), '/settings');
  const showHolidays = settingsQuery.data?.showHolidays ?? true;
  const eventsByDate = useMemo(() => {
    const map: Record<string, CalEvent[]> = {};
    for (const ev of eventsQuery.data ?? []) (map[ev.date] ??= []).push(ev);
    return map;
  }, [eventsQuery.data]);
  const upcoming = upcomingQuery.data ?? [];
  const error = (eventsQuery.error ?? upcomingQuery.error)?.message ?? null;
  const reload = () => invalidate(qk.calendar.all);

  // 월 이동 (delta: -1 이전, +1 다음)
  function handleMoveMonth(delta: number) {
    setView((v) => {
      if (!v) return v;
      const d = new Date(v.year, v.month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  }

  // 연/월 직접 선택
  function handleSelectYear(year: number) {
    setView((v) => (v ? { ...v, year } : v));
  }
  function handleSelectMonth(month: number) {
    setView((v) => (v ? { ...v, month } : v));
  }

  // 일정 삭제 (가상 이벤트면 원본 테이블에서도 삭제)
  async function handleRemoveEvent(ev: CalEvent) {
    const label = ev.virtual && ev.sourceType ? `${VIRT_SOURCE_META[ev.sourceType].label} 항목` : '일정';
    const isRecurring = !ev.virtual && !!ev.recurFreq && ev.recurFreq !== 'none';
    const msg = ev.virtual
      ? `이 ${withEulReul(label)} 삭제할까요? 해당 페이지에서도 삭제됩니다.`
      : isRecurring
        ? '이 일정을 삭제할까요? 이 회차부터 이후 반복이 모두 중단되고, 이전 회차는 유지됩니다.'
        : '이 일정을 삭제할까요?';
    if (!await confirm(msg, 'danger')) return;
    try {
      const query = isRecurring ? `?occurrenceDate=${ev.date}` : '';
      await api.del(`/calendar/${ev.id}${query}`);
      notify.deleted(label);
      setDetailEvent(null);
      reload();
    } catch {
      notify.deleteFailed();
    }
  }

  // 오늘이 속한 달로 이동
  function handleGoToday() {
    const now = new Date();
    setView({ year: now.getFullYear(), month: now.getMonth() });
  }

  // 공휴일 표시 on/off (설정에 저장 — 캘린더 응답이 이 값을 반영하므로 함께 무효화)
  async function handleToggleHolidays() {
    try {
      await api.put('/settings', { showHolidays: !showHolidays });
      invalidate(qk.settings.detail());
      reload();
    } catch (err) {
      notify.error((err as Error).message || '설정 저장에 실패했습니다.');
    }
  }

  const cells = view ? buildMonth(view.year, view.month) : [];

  return (
    <AppShell activePath="/calendar" topbarLabel="캘린더">
      <PageHeader
        title="캘린더"
        description="구독 결제·예적금 만기·서류 만료·할일·메모를 한 곳에서 봅니다."
        actions={<Button onClick={() => setAddModal({ open: true })}>일정 추가</Button>}
      />

      <p className="text-[0.8rem] text-muted bg-surface border border-border-subtle rounded-(--radius) px-3.5 py-2 mb-5">
        ◈ 표시 항목(구독·예적금·신원지갑·할일)은 연동된 데이터입니다. 수정은 각 페이지에서, 삭제 시 원본에서도 삭제됩니다. 날짜를 클릭하면 그 날에 바로 일정을 추가할 수 있습니다.
      </p>

      <ErrorBanner message={error} />

      <div className="grid grid-cols-1 min-[900px]:grid-cols-[1fr_300px] gap-5 items-start">
        <div>
          {/* 월 이동 + 연/월 직접 선택 툴바 */}
          <div className="flex items-center justify-between mb-3.5 flex-wrap gap-2">
            <div className="flex items-center gap-1.5">
              <IconButton label="이전 달" variant="bordered" size="lg" onClick={() => handleMoveMonth(-1)}><span className="text-[1.1rem] leading-none">‹</span></IconButton>
              <select
                className="input w-auto! py-1! text-[0.84rem] font-semibold"
                aria-label="연도 선택"
                value={view?.year ?? ''}
                onChange={(e) => handleSelectYear(Number(e.target.value))}
              >
                {YEAR_OPTIONS.map((y) => <option key={y} value={y}>{y}년</option>)}
              </select>
              <select
                className="input w-auto! py-1! text-[0.84rem] font-semibold"
                aria-label="월 선택"
                value={view?.month ?? ''}
                onChange={(e) => handleSelectMonth(Number(e.target.value))}
              >
                {MONTH_OPTIONS.map((m) => <option key={m} value={m}>{m + 1}월</option>)}
              </select>
              <IconButton label="다음 달" variant="bordered" size="lg" onClick={() => handleMoveMonth(1)}><span className="text-[1.1rem] leading-none">›</span></IconButton>
            </div>
            <Button variant="ghost" size="sm" onClick={handleGoToday}>오늘</Button>
          </div>

          {/* 월 그리드 */}
          <div className="grid grid-cols-7 bg-border gap-px border border-border rounded-[var(--radius-lg)] overflow-hidden">
            {DOW.map((d) => <div key={d} className="bg-surface p-2 text-center text-[0.7rem] font-semibold text-muted uppercase">{d}</div>)}
            {cells.map((cell, i) => {
              const events = cell.iso ? eventsByDate[cell.iso] : undefined;
              const isToday = cell.iso === todayIso;
              // 그리드는 항상 일요일(0열)부터 시작하므로 인덱스%7 == 0/6이 주말
              const dow = i % 7;
              const isHoliday = !!events?.some((ev) => ev.type === 'holiday');
              const isRedDate = !cell.dim && (dow === 0 || dow === 6 || isHoliday);
              return (
                <div
                  key={cell.key}
                  className={`min-h-[92px] max-md:min-h-[64px] p-1.5 flex flex-col gap-[3px] ${cell.dim ? 'bg-surface text-muted' : 'bg-background cursor-pointer hover:bg-surface transition-colors'}`}
                  onClick={cell.iso ? () => setAddModal({ open: true, date: cell.iso }) : undefined}
                >
                  <span className={isToday ? 'bg-accent text-white w-[22px] h-[22px] rounded-full flex items-center justify-center text-[0.78rem] font-semibold' : `text-[0.78rem] font-semibold ${isRedDate ? 'text-danger' : 'text-secondary'}`}>{cell.day}</span>
                  {/* PC/태블릿 — 제목 칩 (좁은 화면은 글자가 안 들어가 점으로 대체) */}
                  <div className="max-md:hidden flex flex-col gap-[3px]">
                    {events?.map((ev) => (
                      <span
                        key={ev.id}
                        className={`text-[0.65rem] px-1.25 py-px rounded-sm whitespace-nowrap overflow-hidden text-ellipsis cursor-pointer hover:opacity-75 transition-opacity ${EV_BG[ev.type]} ${ev.virtual ? 'opacity-75 border border-current border-dashed' : ''}`}
                        onClick={(e) => { e.stopPropagation(); setDetailEvent(ev); }}
                      >
                        {ev.virtual ? '◈ ' : ''}{ev.isLunar ? '🌙 ' : ''}{ev.title}
                      </span>
                    ))}
                  </div>
                  {/* 모바일 — 유형별 점만 표시, 탭하면 그 날 일정 목록 모달 */}
                  {!!events?.length && (
                    <button
                      type="button"
                      className="hidden max-md:flex items-center gap-1 flex-wrap"
                      onClick={(e) => { e.stopPropagation(); setDayList({ day: cell.day, events }); }}
                      aria-label={`${cell.day}일 일정 ${events.length}건 보기`}
                    >
                      {events.slice(0, 4).map((ev) => <span key={ev.id} className={`w-1.5 h-1.5 rounded-full shrink-0 ${DOT_BG[ev.type]}`} />)}
                      {events.length > 4 && <span className="text-[0.55rem] text-muted leading-none">+{events.length - 4}</span>}
                    </button>
                  )}
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
              {upcoming.length === 0 && <EmptyState size="sm" message="다가오는 일정이 없습니다." />}
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
                    {u.type !== 'holiday' && (
                      <IconButton label="일정 삭제" variant="danger" onClick={() => handleRemoveEvent(u)}><IconTrash width={12} height={12} /></IconButton>
                    )}
                  </div>
                );
              })}
            </CardBody>
          </Card>

          <Card>
            <CardHeader><CardTitle>범례</CardTitle></CardHeader>
            <CardBody>
              {EV_LEGEND.map((l) => (
                <div className="flex items-center gap-2 text-[0.78rem] mb-1.5" key={l.type}>
                  <span className={`w-2.5 h-2.5 rounded-[3px] ${DOT_BG[l.type]}`} />{l.label}
                </div>
              ))}
              <div className="flex items-center gap-2 text-[0.78rem] mb-3.5">
                <span className="w-2.5 h-2.5 rounded-[3px] bg-danger" />공휴일
              </div>
              <div className="flex items-center justify-between pt-3 border-t border-border-subtle">
                <span className="text-[0.78rem] text-secondary">공휴일 표시</span>
                <Toggle on={showHolidays} onToggle={handleToggleHolidays} label="공휴일 표시" />
              </div>
            </CardBody>
          </Card>
        </div>
      </div>

      {/* 일정 추가 모달 */}
      <AddEventModal state={addModal} onClose={() => setAddModal({ open: false })} onSaved={() => { setAddModal({ open: false }); reload(); }} />

      {/* 일정 상세/삭제 모달 */}
      <EventDetailModal event={detailEvent} onClose={() => setDetailEvent(null)} onDelete={(ev) => handleRemoveEvent(ev)} />

      {/* 모바일 — 날짜 점 탭 시 그 날 일정 목록 모달 */}
      <DayListModal day={dayList} onClose={() => setDayList(null)} onSelect={(ev) => { setDayList(null); setDetailEvent(ev); }} />

      {confirmElement}
    </AppShell>
  );
}

// 일정 상세 / 삭제 모달
function EventDetailModal({ event, onClose, onDelete }: { event: CalEvent | null; onClose: () => void; onDelete: (ev: CalEvent) => void }) {
  if (!event) return null;
  const [, m, d] = event.date.split('-');
  const sourceMeta = event.virtual && event.sourceType && event.sourceType !== 'holiday' ? VIRT_SOURCE_META[event.sourceType] : null;
  return (
    <Modal open={!!event} onClose={onClose} title="일정 상세">
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-[0.75rem] px-2 py-0.5 rounded-sm ${EV_BG[event.type]}`}>{EV_TYPE_LABEL[event.type]}</span>
          {sourceMeta && <span className="text-[0.72rem] px-2 py-0.5 rounded-sm bg-surface border border-border-subtle text-muted">◈ {sourceMeta.label} 연동</span>}
          <span className="text-[0.84rem] text-secondary">{Number(m)}월 {d}일</span>
          {event.isLunar && (
            <span className="text-[0.72rem] px-2 py-0.5 rounded-sm bg-surface border border-border-subtle text-muted">
              🌙 음력 {event.lunarMonth}월 {event.lunarDay}일{event.lunarLeap ? '(윤달)' : ''}
            </span>
          )}
          {event.recurFreq && event.recurFreq !== 'none' && (
            <span className="text-[0.72rem] px-2 py-0.5 rounded-sm bg-surface border border-border-subtle text-muted">
              🔁 {RECUR_FREQ_LABEL[event.recurFreq]}{event.recurUntil ? ` · ${event.recurUntil}까지` : ''}
            </span>
          )}
        </div>
        <p className="text-[1rem] font-semibold text-primary">{event.title}</p>
        {event.memo && <p className="text-[0.875rem] text-secondary bg-surface border border-border-subtle rounded-(--radius) px-3 py-2">{event.memo}</p>}
      </div>
      <div className="flex justify-between mt-5">
        {event.type !== 'holiday' ? (
          <Button variant="danger" size="sm" onClick={() => onDelete(event)}>삭제</Button>
        ) : <span />}
        <Button variant="ghost" size="sm" onClick={onClose}>닫기</Button>
      </div>
    </Modal>
  );
}

// 모바일 — 날짜 점 탭 시 그 날 일정 목록 (항목 선택 시 EventDetailModal 로 이어짐)
function DayListModal({ day, onClose, onSelect }: { day: { day: number; events: CalEvent[] } | null; onClose: () => void; onSelect: (ev: CalEvent) => void }) {
  if (!day) return null;
  return (
    <Modal open={!!day} onClose={onClose} title={`${day.day}일 일정`}>
      <div className="flex flex-col gap-2">
        {day.events.map((ev) => (
          <button
            key={ev.id}
            type="button"
            className="flex items-center gap-2.5 px-3 py-2.5 rounded-(--radius) border border-border-subtle text-left hover:bg-surface transition-colors"
            onClick={() => onSelect(ev)}
          >
            <span className={`w-2 h-2 rounded-full shrink-0 ${DOT_BG[ev.type]}`} />
            <span className="flex-1 min-w-0 text-[0.875rem] font-medium text-primary truncate">{ev.virtual ? '◈ ' : ''}{ev.isLunar ? '🌙 ' : ''}{ev.title}</span>
            <span className="text-[0.72rem] text-muted shrink-0">{EV_TYPE_LABEL[ev.type]}</span>
          </button>
        ))}
      </div>
    </Modal>
  );
}

// 일정 추가 모달 — 날짜 셀 클릭 시 state.date 로 미리 채워짐
function AddEventModal({ state, onClose, onSaved }: { state: { open: boolean; date?: string }; onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [type, setType] = useState<EvType>('pay');
  const [memo, setMemo] = useState('');
  const [isLunar, setIsLunar] = useState(false);
  const [recurFreq, setRecurFreq] = useState<RecurFreq>('none');
  const [recurUntil, setRecurUntil] = useState('');
  const [saving, setSaving] = useState(false);
  const { errors, setErrors, clearError, reset } = useFormErrors();

  useEffect(() => {
    if (!state.open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 모달 열릴 때 폼 초기화
    reset(); setTitle(''); setType('pay'); setMemo(''); setIsLunar(false); setRecurFreq('none'); setRecurUntil('');
    setDate(state.date ?? localDate());
  }, [state.open, state.date, reset]);

  // 음력 체크 시 반복 옵션을 매년으로 제한(음력 매주/매월 반복은 지원하지 않음) — 음력 체크의 주 목적이 매년 반복(생일 등)이므로 기본값도 매년으로
  function handleLunarToggle(checked: boolean) {
    setIsLunar(checked);
    if (checked) setRecurFreq('yearly');
  }

  function validate() {
    const err: Record<string, string> = {};
    if (!title.trim()) err.title = '제목을 입력하세요.';
    if (!date) err.date = '날짜를 선택하세요.';
    setErrors(err);
    return !Object.keys(err).length;
  }

  async function handleSave() {
    if (!validate()) return;
    setSaving(true);
    try {
      await api.post('/calendar', {
        title: title.trim(), date, type, memo: memo || undefined,
        isLunar: isLunar || undefined,
        recurFreq: recurFreq !== 'none' ? recurFreq : undefined,
        recurUntil: recurFreq !== 'none' && recurUntil ? recurUntil : undefined,
      });
      notify.added('일정');
      onSaved();
    } catch (err) {
      notify.error((err as Error).message || '저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={state.open} onClose={onClose} title="일정 추가" footer={<ModalFooter onClose={onClose} onSave={handleSave} saving={saving} />}>
      <Field label="제목" required error={errors.title}>
        <input type="text" className="input" placeholder="예: 보험 갱신" value={title} onChange={(e) => { setTitle(e.target.value); clearError('title'); }} />
      </Field>
      <div className="grid grid-cols-2 gap-4 max-md:grid-cols-1">
        <Field label="날짜" required error={errors.date}>
          <input type="date" className="input" aria-label="날짜" value={date} onChange={(e) => { setDate(e.target.value); clearError('date'); }} />
        </Field>
        <Field label="유형" required>
          <select className="input" aria-label="유형" value={type} onChange={(e) => setType(e.target.value as EvType)}>
            {EV_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </Field>
      </div>
      <div className="-mt-1">
        <label className="flex items-center gap-1.5 text-[0.84rem] text-secondary cursor-pointer">
          <input type="checkbox" checked={isLunar} onChange={(e) => handleLunarToggle(e.target.checked)} />
          🌙 음력 날짜로 반복
        </label>
      </div>
      {isLunar && (
        <p className="text-[0.72rem] text-muted -mt-1">위 날짜(양력)에 해당하는 음력 날짜를 기준으로 매년 반복합니다.</p>
      )}
      <div className="grid grid-cols-2 gap-4 max-md:grid-cols-1">
        <Field label="반복">
          <select className="input" aria-label="반복" value={recurFreq} onChange={(e) => setRecurFreq(e.target.value as RecurFreq)}>
            {(isLunar ? LUNAR_RECUR_FREQ_OPTIONS : RECUR_FREQ_OPTIONS).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </Field>
        {recurFreq !== 'none' && (
          <Field label="반복 종료일 (선택)">
            <input type="date" className="input" aria-label="반복 종료일" value={recurUntil} onChange={(e) => setRecurUntil(e.target.value)} />
          </Field>
        )}
      </div>
      <Field label="메모 (선택)"><input type="text" className="input" placeholder="추가 메모" value={memo} onChange={(e) => setMemo(e.target.value)} /></Field>
    </Modal>
  );
}
