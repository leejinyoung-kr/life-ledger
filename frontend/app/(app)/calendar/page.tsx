'use client';

/**
 * 캘린더 페이지.
 * 구독 결제·예적금 만기·서류 만료·할일을 월 그리드에 모아 본다.
 * 월 그리드는 Date 계산으로 직접 생성(라이브러리 미사용), 데이터는 API(/calendar)와 연동한다.
 * 날짜를 누르면 오른쪽(휴대폰은 아래)에 그날 목록과 추가 버튼이 열린다.
 */
import { useEffect, useMemo, useState } from 'react';
import { IconCalendarPlus, IconChevronRight, IconClose, IconEdit, IconExternal, IconLink, IconMoon, IconPlus } from '@/components/icons';
import { notify } from '@/lib/toast';
import { withEulReul } from '@/lib/korean';
import { useApiQuery, useInvalidate } from '@/lib/query';
import { useFormErrors } from '@/lib/useFormErrors';
import { qk } from '@/lib/queryKeys';
import { clickable } from '@/lib/a11y';
import AppShell from '@/components/AppShell';
import PageHeader from '@/components/PageHeader';
import ErrorBanner from '@/components/ErrorBanner';
import EmptyState from '@/components/EmptyState';
import Modal from '@/components/Modal';
import Button from '@/components/ui/Button';
import IconButton from '@/components/ui/IconButton';
import Segmented from '@/components/ui/Segmented';
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
  type CalEvent, type EvType, type RecurFreq,
} from '@/lib/calendar';
import { TypeMark, CHIP_TONE } from './parts';

const DOW = ['일', '월', '화', '수', '목', '금', '토'];

// 2자리 0 패딩
const pad = (n: number) => String(n).padStart(2, '0');
const isoOf = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;

// YYYY-MM-DD → "10월 18일 일요일"
function dayLabel(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return `${m}월 ${d}일 ${DOW[new Date(y, m - 1, d).getDay()]}요일`;
}

// 두 날짜(YYYY-MM-DD) 사이 일수 (to - from)
function daysBetween(from: string, to: string): number {
  const [fy, fm, fd] = from.split('-').map(Number);
  const [ty, tm, td] = to.split('-').map(Number);
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86400000);
}

// 연동 일정(구독·예적금·투자 계좌 만기) 여부 — 공휴일은 연동 표시를 하지 않는다
const isLinked = (ev: CalEvent) => ev.virtual && ev.type !== 'holiday';

// 연동 일정의 원래 화면 경로 (없으면 null)
const sourcePath = (ev: CalEvent) => (isLinked(ev) && ev.sourceType ? VIRT_SOURCE_META[ev.sourceType].path || null : null);

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
  // 날짜 칸을 눌러 고른 날 — 보는 달이 바뀌면 오늘(또는 1일)로 되돌아간다 (selIso 에서 계산)
  const [picked, setPicked] = useState<string | null>(null);
  // 일정 추가/수정 모달 — event 가 있으면 수정
  const [addModal, setAddModal] = useState<EventFormState>({ open: false });
  const [detailEvent, setDetailEvent] = useState<CalEvent | null>(null);
  const { confirm, confirmElement } = useConfirm();
  const invalidate = useInvalidate();

  useEffect(() => {
    const now = new Date();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 클라이언트 마운트 시점의 오늘 날짜로 초기화 (SSR과 클라이언트 시각 불일치 방지)
    setTodayIso(isoOf(now.getFullYear(), now.getMonth(), now.getDate()));
    setView({ year: now.getFullYear(), month: now.getMonth() });
  }, []);

  // 현재 view 월의 일정 (React Query 캐시)
  const month = view ? `${view.year}-${pad(view.month + 1)}` : null;
  const eventsQuery = useApiQuery<CalEvent[]>(qk.calendar.list(month ?? undefined), `/calendar?month=${month}`, { enabled: !!month });
  const settingsQuery = useApiQuery<Settings>(qk.settings.detail(), '/settings');
  const showHolidays = settingsQuery.data?.showHolidays ?? true;
  const eventsByDate = useMemo(() => {
    const map: Record<string, CalEvent[]> = {};
    for (const ev of eventsQuery.data ?? []) (map[ev.date] ??= []).push(ev);
    return map;
  }, [eventsQuery.data]);
  const error = eventsQuery.error?.message ?? null;
  const reload = () => invalidate(qk.calendar.all);

  // 목록에 보여 줄 날 — 고른 날이 보는 달 안이면 그 날, 아니면 오늘(보는 달에 있을 때) 또는 1일
  const selIso = month
    ? (picked && picked.startsWith(month) ? picked : todayIso.startsWith(month) ? todayIso : `${month}-01`)
    : '';
  const selEvents = eventsByDate[selIso] ?? [];

  // 월 이동 (delta: -1 이전, +1 다음)
  function handleMoveMonth(delta: number) {
    setView((v) => {
      if (!v) return v;
      const d = new Date(v.year, v.month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
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

  // 오늘이 속한 달로 이동하고 오늘을 고른다
  function handleGoToday() {
    const now = new Date();
    setView({ year: now.getFullYear(), month: now.getMonth() });
    setPicked(null);
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
    <AppShell activePath="/calendar">
      <PageHeader
        title="캘린더"
        description="구독 결제 · 예적금 만기 · 서류 만료 · 할일 · 메모를 한 곳에서 봅니다."
        actions={<Button onClick={() => setAddModal({ open: true, date: selIso || undefined })}><IconPlus />일정 추가</Button>}
      />

      <ErrorBanner message={error} />

      <div className="grid grid-cols-1 min-[900px]:grid-cols-[minmax(0,1fr)_300px] gap-6 items-start">
        <div className="flex flex-col gap-2.5 min-w-0">
          {/* 월 이동 */}
          <div className="flex items-center gap-1.5">
            <IconButton label="이전 달" variant="bordered" size="lg" onClick={() => handleMoveMonth(-1)}><IconChevronRight className="rotate-180" /></IconButton>
            <span className="[font-family:var(--font-display)] text-[1.375rem] font-semibold px-2 lining-nums text-primary">
              {view ? `${view.year}년 ${view.month + 1}월` : ''}
            </span>
            <IconButton label="다음 달" variant="bordered" size="lg" onClick={() => handleMoveMonth(1)}><IconChevronRight /></IconButton>
            <span className="flex-1" />
            <Button variant="ghost" size="sm" onClick={handleGoToday}>오늘</Button>
          </div>

          {/* 월 그리드 */}
          <div className="grid grid-cols-7 border-t border-l border-border-subtle">
            {DOW.map((d, i) => (
              <div key={d} className={`px-2 py-1.5 text-[0.75rem] border-r border-b border-r-border-subtle border-b-border${i === 0 ? 'text-danger' : 'text-muted'}`}>{d}</div>
            ))}
            {cells.map((cell, i) => {
              const events = cell.iso ? eventsByDate[cell.iso] : undefined;
              const isToday = cell.iso === todayIso;
              const isSel = !!cell.iso && cell.iso === selIso;
              // 그리드는 항상 일요일(0열)부터 시작하므로 인덱스%7 == 0 이 일요일 (토요일은 빨갛게 하지 않는다)
              const isHoliday = !!events?.some((ev) => ev.type === 'holiday');
              const isRedDate = !cell.dim && (i % 7 === 0 || isHoliday);
              const shown = events?.slice(0, 2) ?? [];
              const more = (events?.length ?? 0) - shown.length;
              return (
                <div
                  key={cell.key}
                  className={`min-h-[96px] max-md:min-h-[54px] min-w-0 px-[5px] py-1 flex flex-col gap-[3px] border-r border-b border-border-subtle ${cell.dim ? 'opacity-40' : 'cursor-pointer hover:bg-surface transition-colors'} ${isSel ? 'ring-[1.5px] ring-inset ring-accent' : ''}`}
                  {...(cell.iso ? { onClick: () => setPicked(cell.iso!), ...clickable(() => setPicked(cell.iso!)), 'aria-label': `${cell.day}일${events?.length ? ` 일정 ${events.length}건` : ''}` } : {})}
                >
                  <span className={`self-start max-md:self-center w-6 h-6 grid place-items-center rounded-full text-[0.78rem] border ${isToday ? 'border-accent text-accent-dark' : `border-transparent ${isRedDate ? 'text-danger' : 'text-primary'}`}`}>{cell.day}</span>
                  {/* PC/태블릿 — 제목 칩 (좁은 화면은 글자가 안 들어가 점으로 대체) */}
                  <div className="max-md:hidden flex flex-col gap-[3px] min-w-0">
                    {shown.map((ev) => (
                      <span
                        key={ev.id}
                        className={`flex items-center gap-[3px] text-[0.6875rem] leading-[1.3] px-1 py-px border rounded-[2px] min-w-0 whitespace-nowrap overflow-hidden ${isLinked(ev) ? 'border-dashed' : 'border-solid'} ${CHIP_TONE[ev.type]}`}
                      >
                        {isLinked(ev) && <IconLink width={10} height={10} className="shrink-0" />}
                        {ev.isLunar && <IconMoon width={10} height={10} className="shrink-0" />}
                        <span className="overflow-hidden text-ellipsis">{ev.title}</span>
                      </span>
                    ))}
                    {more > 0 && <span className="text-[0.6875rem] text-muted">+{more}</span>}
                  </div>
                  {/* 휴대폰 — 유형 표식 점만 표시 */}
                  {!!events?.length && (
                    <div className="hidden max-md:flex gap-0.5 justify-center flex-wrap">
                      {events.slice(0, 4).map((ev) => <TypeMark key={ev.id} type={ev.type} size="sm" />)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <p className="text-[0.75rem] text-muted flex gap-1.5 items-start">
            <IconLink width={13} height={13} className="shrink-0 mt-[3px]" />
            <span>점선 + 연결 표시 = 연동 일정(구독 결제 · 예적금 · 투자 계좌 만기 · 공휴일). 수정은 원래 화면에서, 삭제하면 원본도 삭제됩니다. 날짜를 누르면 그날 목록이 열립니다.</span>
          </p>
        </div>

        {/* 우측(휴대폰은 아래) — 고른 날 목록 + 범례 */}
        <div className="flex flex-col gap-5 min-w-0">
          <Card>
            <CardHeader>
              <CardTitle>{selIso ? dayLabel(selIso) : ''}</CardTitle>
              <span className="text-[0.75rem] text-muted">{selIso && todayIso ? ddLabel(daysBetween(todayIso, selIso)) : ''}</span>
            </CardHeader>
            {selEvents.length === 0 && <EmptyState size="sm" message="이 날은 일정이 없습니다." />}
            {selEvents.map((ev) => {
              const path = sourcePath(ev);
              return (
                <div key={ev.id} className="flex items-center gap-2.5 pl-[18px] pr-3 py-2.5 border-b border-border-subtle">
                  <button type="button" className="flex flex-1 min-w-0 items-center gap-2.5 text-left cursor-pointer" onClick={() => setDetailEvent(ev)}>
                    <TypeMark type={ev.type} />
                    <span className="flex flex-col min-w-0 leading-[1.35]">
                      <span className="flex items-center gap-1.5 text-[0.84rem] text-primary min-w-0">
                        <span className="truncate">{ev.title}</span>
                        {isLinked(ev) && <IconLink width={12} height={12} className="shrink-0 text-muted" />}
                        {ev.isLunar && <IconMoon width={12} height={12} className="shrink-0 text-muted" />}
                      </span>
                      <span className="text-[0.72rem] text-muted">
                        {EV_TYPE_LABEL[ev.type]}{ev.type === 'holiday' ? '' : isLinked(ev) ? ' · 연동 — 원래 화면에서 수정' : ' · 직접 입력'}
                      </span>
                    </span>
                  </button>
                  {path && <IconButton label="원래 화면으로" href={path}><IconExternal /></IconButton>}
                  {!ev.virtual && <IconButton label="수정" onClick={() => setAddModal({ open: true, event: ev })}><IconEdit /></IconButton>}
                </div>
              );
            })}
            <div className="px-[18px] py-3">
              <Button variant="ghost" className="w-full" onClick={() => setAddModal({ open: true, date: selIso })}><IconCalendarPlus />이 날에 일정 추가</Button>
            </div>
          </Card>

          <Card>
            <CardHeader><CardTitle>범례</CardTitle></CardHeader>
            <CardBody>
              <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-[0.8125rem]">
                {EV_LEGEND.map((l) => (
                  <span className="flex items-center gap-2" key={l.type}><TypeMark type={l.type} />{l.label}</span>
                ))}
                <span className="flex items-center gap-2 text-danger"><span className="text-[0.75rem] w-[9px] text-center">3</span>공휴일</span>
                <span className="flex items-center gap-2"><IconMoon width={12} height={12} />음력</span>
                <span className="flex items-center gap-1.5 col-span-2 text-[0.75rem] text-muted">
                  <span className="px-1 border border-dashed border-border">점선</span>연동 · <span className="px-1 border border-border">실선</span>직접 입력
                </span>
              </div>
            </CardBody>
            <div className="flex items-center justify-between px-[18px] py-3 border-t border-border-subtle">
              <span className="text-[0.8125rem]">공휴일 표시</span>
              <Toggle on={showHolidays} onToggle={handleToggleHolidays} label="공휴일 표시" />
            </div>
          </Card>
        </div>
      </div>

      {/* 일정 추가/수정 모달 */}
      <EventFormModal state={addModal} onClose={() => setAddModal({ open: false })} onSaved={() => { setAddModal({ open: false }); reload(); }} />

      {/* 일정 상세 모달 (수정·삭제) */}
      <EventDetailModal
        event={detailEvent}
        onClose={() => setDetailEvent(null)}
        onEdit={(ev) => { setDetailEvent(null); setAddModal({ open: true, event: ev }); }}
        onDelete={(ev) => handleRemoveEvent(ev)}
      />

      {confirmElement}
    </AppShell>
  );
}

// 일정 상세 모달 — 직접 등록한 일정은 수정, 연동 일정은 원래 화면으로 이동, 공휴일이 아니면 삭제
function EventDetailModal({ event, onClose, onEdit, onDelete }: { event: CalEvent | null; onClose: () => void; onEdit: (ev: CalEvent) => void; onDelete: (ev: CalEvent) => void }) {
  if (!event) return null;
  const linked = isLinked(event);
  const path = sourcePath(event);
  const sourceLabel = linked && event.sourceType ? VIRT_SOURCE_META[event.sourceType].label : '';
  const recurring = !!event.recurFreq && event.recurFreq !== 'none';
  return (
    <Modal
      open={!!event}
      onClose={onClose}
      title="일정 상세"
      size="sm"
      header={
        <div className="flex items-start gap-3 px-5 py-4 border-b border-border-subtle">
          <span className="mt-2.5 shrink-0"><TypeMark type={event.type} /></span>
          <div className="flex-1 min-w-0 flex flex-col gap-0.5">
            <span className="[font-family:var(--font-display)] text-[1.25rem] font-semibold leading-tight lining-nums text-primary break-words">{event.title}</span>
            <span className="text-[0.78rem] text-muted">{EV_TYPE_LABEL[event.type]}</span>
          </div>
          <IconButton label="닫기" variant="bordered" size="lg" onClick={onClose}><IconClose width={16} height={16} /></IconButton>
        </div>
      }
      footer={
        <div className="flex w-full justify-between gap-2">
          {event.type !== 'holiday' ? <Button variant="danger" onClick={() => onDelete(event)}>삭제</Button> : <span />}
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>닫기</Button>
            {path && <Button href={path}><IconExternal />원래 화면으로</Button>}
            {!event.virtual && <Button onClick={() => onEdit(event)}><IconEdit />수정</Button>}
          </div>
        </div>
      }
    >
      <div className="grid grid-cols-[72px_1fr] gap-x-3 gap-y-2 text-[0.84rem]">
        <span className="text-muted">날짜</span>
        <span>{event.date} ({DOW[new Date(`${event.date}T00:00:00`).getDay()]})</span>
        {event.isLunar && (
          <>
            <span className="text-muted">음력</span>
            <span className="flex items-center gap-1.5"><IconMoon width={13} height={13} />{event.lunarMonth}월 {event.lunarDay}일{event.lunarLeap ? ' (윤달)' : ''}</span>
          </>
        )}
        {recurring && (
          <>
            <span className="text-muted">반복</span>
            <span>{RECUR_FREQ_LABEL[event.recurFreq!]}{event.recurUntil ? ` · ${event.recurUntil}까지` : ''}</span>
          </>
        )}
        {event.memo && (
          <>
            <span className="text-muted">메모</span>
            <span className="break-words">{event.memo}</span>
          </>
        )}
      </div>
      {linked && (
        <div className="px-3 py-2.5 border border-dashed border-border rounded-ui flex gap-2 items-center text-[0.8125rem]">
          <IconLink width={14} height={14} className="shrink-0 text-muted" />
          <span className="flex-1">{sourceLabel} 관리에서 온 일정입니다. 수정은 원래 화면에서 합니다.</span>
        </div>
      )}
    </Modal>
  );
}

// 추가/수정 모달 상태 — date: 목록에서 고른 날짜로 미리 채울 날짜, event: 수정할 일정
interface EventFormState { open: boolean; date?: string; event?: CalEvent }

// 일정 추가/수정 모달 — 추가는 고른 날짜(state.date)로, 수정은 state.event 값으로 미리 채워짐
function EventFormModal({ state, onClose, onSaved }: { state: EventFormState; onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [type, setType] = useState<EvType>('pay');
  const [memo, setMemo] = useState('');
  const [isLunar, setIsLunar] = useState(false);
  const [recurFreq, setRecurFreq] = useState<RecurFreq>('none');
  const [recurUntil, setRecurUntil] = useState('');
  const [saving, setSaving] = useState(false);
  const { errors, setErrors, clearError, reset } = useFormErrors();

  const editing = state.event;
  const isRecurring = recurFreq !== 'none';

  useEffect(() => {
    if (!state.open) return;
    const ev = state.event;
    reset();
    if (ev) {
      // 반복 일정은 클릭한 회차가 아니라 원래 날짜(첫 회차)를 고친다
      // eslint-disable-next-line react-hooks/set-state-in-effect -- 모달 열릴 때 폼 초기화
      setTitle(ev.title); setDate(ev.startDate ?? ev.date); setType(ev.type); setMemo(ev.memo ?? '');
      setIsLunar(!!ev.isLunar); setRecurFreq(ev.recurFreq ?? 'none'); setRecurUntil(ev.recurUntil ?? '');
    } else {
      setTitle(''); setType('pay'); setMemo(''); setIsLunar(false); setRecurFreq('none'); setRecurUntil('');
      setDate(state.date ?? localDate());
    }
  }, [state.open, state.date, state.event, reset]);

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
      if (editing) {
        // 수정은 비운 칸을 null 로 보내 지운다 (undefined 는 서버에서 '그대로 둠')
        await api.put(`/calendar/${editing.id}`, {
          title: title.trim(), date, type, memo: memo || null,
          isLunar,
          recurFreq,
          recurUntil: isRecurring && recurUntil ? recurUntil : null,
        });
        notify.updated('일정');
      } else {
        await api.post('/calendar', {
          title: title.trim(), date, type, memo: memo || undefined,
          isLunar: isLunar || undefined,
          recurFreq: isRecurring ? recurFreq : undefined,
          recurUntil: isRecurring && recurUntil ? recurUntil : undefined,
        });
        notify.added('일정');
      }
      onSaved();
    } catch (err) {
      notify.error((err as Error).message || '저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  }

  const recurSubtitle = editing && isRecurring ? '반복 일정은 모든 회차에 적용됩니다. 날짜는 첫 회차 기준입니다.' : undefined;
  return (
    <Modal
      open={state.open}
      onClose={onClose}
      title={editing ? '일정 수정' : '일정 추가'}
      subtitle={recurSubtitle ?? (date ? dayLabel(date) : undefined)}
      footer={<ModalFooter onClose={onClose} onSave={handleSave} saving={saving} />}
    >
      <Field label="제목" required error={errors.title}>
        <input type="text" className="input" placeholder="예: 연말정산 서류 챙기기" value={title} onChange={(e) => { setTitle(e.target.value); clearError('title'); }} />
      </Field>
      {/* 묶음 선택은 Field(label)에 넣으면 라벨을 눌러도 첫 칸이 눌려서 따로 둔다 */}
      <div className="flex flex-col gap-1.5" role="group" aria-label="유형">
        <span className="text-[0.78rem] text-muted">유형</span>
        <Segmented
          variant="soft"
          label="유형"
          className="flex-wrap"
          value={type}
          onChange={setType}
          items={EV_TYPE_OPTIONS.map((o) => ({ value: o.value, label: <span className="inline-flex items-center gap-2"><TypeMark type={o.value} />{o.label}</span> }))}
        />
      </div>
      <div className="grid grid-cols-2 gap-4 max-md:grid-cols-1 items-start">
        <div className="flex flex-col gap-2">
          <Field label={editing && isRecurring ? '시작일' : '날짜'} required error={errors.date}>
            <input type="date" className="input" aria-label="날짜" value={date} onChange={(e) => { setDate(e.target.value); clearError('date'); }} />
          </Field>
          <label className="flex items-center gap-2 min-h-8 text-[0.84rem] text-secondary cursor-pointer">
            <input type="checkbox" className="checkbox" checked={isLunar} onChange={(e) => handleLunarToggle(e.target.checked)} />
            <IconMoon width={14} height={14} className="text-muted" />
            음력 날짜로 반복
          </label>
          {isLunar && (
            <p className="text-[0.72rem] text-muted">위 날짜(양력)에 해당하는 음력 날짜를 기준으로 매년 반복합니다.</p>
          )}
        </div>
        <div className="flex flex-col gap-4">
          <Field label="반복">
            <select className="input" aria-label="반복" value={recurFreq} onChange={(e) => setRecurFreq(e.target.value as RecurFreq)}>
              {(isLunar ? LUNAR_RECUR_FREQ_OPTIONS : RECUR_FREQ_OPTIONS).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </Field>
          {isRecurring && (
            <Field label="반복 종료일 (선택)">
              <input type="date" className="input" aria-label="반복 종료일" value={recurUntil} onChange={(e) => setRecurUntil(e.target.value)} />
            </Field>
          )}
        </div>
      </div>
      <Field label="메모 (선택)"><textarea className="input min-h-[72px]" placeholder="추가 정보" value={memo} onChange={(e) => setMemo(e.target.value)} /></Field>
    </Modal>
  );
}
