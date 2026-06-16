'use client';

/**
 * 할일/목표 페이지.
 * 운영 todo(체크 토글)와 저축·자산 목표(진행바)를 2단으로 함께 추적한다.
 * 데이터는 백엔드 API(/tasks, /goals)와 연동한다.
 * 스타일: Tailwind + 공통 컴포넌트(Card/Button/Badge/Field). 진행바(track/fill)는 공통 globals.
 */
import { useEffect, useMemo, useState } from 'react';
import { notify } from '@/lib/toast';
import { useApiQuery, useInvalidate, type Paginated } from '@/lib/query';
import { qk } from '@/lib/queryKeys';
import AppShell from '@/components/AppShell';
import Pagination, { LimitSelect } from '@/components/Pagination';
import Modal from '@/components/Modal';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Field, ModalFooter } from '@/components/ui/Field';
import { useConfirm } from '@/components/ConfirmModal';
import { IconCheck, IconEdit, IconSearch, IconTrash } from '@/components/icons';
import { api } from '@/lib/api';
import { useFormErrors } from '@/lib/useFormErrors';
import { usePagination } from '@/lib/usePagination';
import { useRowSelection } from '@/lib/useRowSelection';
import {
  PRIORITY_OPTIONS, formatDue, isSoon, formatGoalValue,
  type Task, type Goal, type TaskPriority, type GoalTone,
} from '@/lib/task';

export default function TasksPage() {
  const [search, setSearch] = useState('');
  const [addModal, setAddModal] = useState(false);
  const [goalModal, setGoalModal] = useState<{ open: boolean; editing?: Goal }>({ open: false });
  const { page, setPage, limit, changeLimit } = usePagination();
  const { confirm, confirmElement } = useConfirm();
  const invalidate = useInvalidate();

  // 할일/목표 (React Query 캐시). 할일은 서버 페이징/검색. allCount/done 은 전체 기준(완료 배지)
  const listQs = useMemo(() => {
    const params = new URLSearchParams();
    if (search.trim()) params.set('q', search.trim());
    params.set('page', String(page));
    params.set('limit', String(limit));
    return params.toString();
  }, [search, page, limit]);
  const tasksQuery = useApiQuery<Paginated<Task> & { allCount: number; done: number }>(qk.tasks.list({ q: search.trim(), page, limit }), `/tasks?${listQs}`);
  const goalsQuery = useApiQuery<Goal[]>(qk.tasks.goals(), '/goals');
  const tasks = useMemo(() => tasksQuery.data?.items ?? [], [tasksQuery.data]);
  const total = tasksQuery.data?.total ?? 0;
  const allCount = tasksQuery.data?.allCount ?? 0;
  const doneCount = tasksQuery.data?.done ?? 0;
  const goals = useMemo(() => goalsQuery.data ?? [], [goalsQuery.data]);
  const error = (tasksQuery.error ?? goalsQuery.error)?.message ?? null;
  const reload = () => invalidate(qk.tasks.all);

  // 완료 토글 (PUT 후 목록 무효화)
  async function toggleTask(id: number) {
    const target = tasks.find((t) => t.id === id);
    if (!target) return;
    const next = !target.done;
    try {
      await api.put(`/tasks/${id}`, { done: next });
      notify.success(next ? '할일을 완료했습니다.' : '할일을 미완료로 변경했습니다.');
      reload();
    } catch (e) {
      notify.error((e as Error).message);
    }
  }

  // 할일 삭제 (soft delete)
  async function removeTask(id: number) {
    if (!await confirm('이 할일을 삭제할까요?', 'danger')) return;
    try {
      await api.del(`/tasks/${id}`);
      notify.deleted('할일');
      clearSelectedTasks();
      reload();
    } catch {
      notify.deleteFailed();
    }
  }

  async function removeSelectedTasks() {
    if (selectedTasks.size === 0) return;
    if (!await confirm(`선택한 ${selectedTasks.size}건을 삭제할까요?`, 'danger')) return;
    try {
      await api.del('/tasks/bulk', { ids: [...selectedTasks] });
      notify.deleted(`${selectedTasks.size}건`);
      clearSelectedTasks();
      reload();
    } catch {
      notify.deleteFailed();
    }
  }

  // 목표 삭제
  async function removeGoal(id: number) {
    if (!await confirm('이 목표를 삭제할까요?', 'danger')) return;
    try {
      await api.del(`/goals/${id}`);
      notify.deleted('목표');
      reload();
    } catch {
      notify.deleteFailed();
    }
  }

  const totalPages = Math.ceil(total / limit);
  const pagedTasks = tasks; // 서버가 이미 검색+페이지 단위로 잘라서 보냄
  const { selected: selectedTasks, toggle: toggleSelectTask, toggleAll: toggleSelectAllTasks, clear: clearSelectedTasks, allChecked: allTasksChecked } = useRowSelection(pagedTasks.map((t) => t.id));

  return (
    <AppShell activePath="/tasks" topbarLabel="할일 / 목표">
      <div className="mb-7 flex items-center justify-between gap-4">
        <div>
          <h1 className="[font-family:var(--font-display)] text-[1.55rem] font-bold tracking-[-0.03em] text-primary">할일 / 목표</h1>
          <p className="text-sm text-secondary mt-1.5">운영 todo 와 저축·자산 목표를 함께 추적합니다.</p>
        </div>
        <Button onClick={() => setAddModal(true)}>할일 추가</Button>
      </div>

      {error && <p className="mt-3 mb-3 text-[0.78rem] text-danger">⚠️ {error}</p>}

      <div className="grid grid-cols-1 min-[900px]:grid-cols-2 gap-5 items-start">
        {/* 할 일 */}
        <Card>
          <CardHeader>
            <CardTitle>할 일</CardTitle>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative">
                <IconSearch className="absolute left-2.75 top-1/2 -translate-y-1/2 text-muted w-3.75 h-3.75 pointer-events-none" />
                <input className="input pl-icon w-40" type="text" placeholder="할일 검색..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} aria-label="할일 검색" />
              </div>
              <LimitSelect limit={limit} onLimitChange={changeLimit} />
              <Button variant="danger" disabled={selectedTasks.size === 0} onClick={removeSelectedTasks}>선택삭제</Button>
              <Badge tone="neutral">{doneCount} / {allCount} 완료</Badge>
            </div>
          </CardHeader>
          <div>
            {pagedTasks.length > 0 && (
              <div className="flex items-center gap-2.5 px-4 py-2 border-b border-border-subtle bg-surface">
                <input type="checkbox" className="checkbox" checked={allTasksChecked} onChange={toggleSelectAllTasks} aria-label="전체선택" />
                <span className="text-[0.78rem] text-muted">{selectedTasks.size > 0 ? `${selectedTasks.size}건 선택됨` : '전체선택'}</span>
              </div>
            )}
            {pagedTasks.length === 0 && <div className="px-4 py-3 text-[0.875rem] text-muted">할 일이 없습니다.</div>}
            {pagedTasks.map((task) => (
              <div className="flex items-center gap-2.5 px-4 py-3 border-b border-border-subtle last:border-b-0 transition-colors hover:bg-surface" key={task.id}>
                <input type="checkbox" className="checkbox" checked={selectedTasks.has(task.id)} onChange={() => toggleSelectTask(task.id)} aria-label="선택" />
                <button
                  type="button"
                  className={`w-[18px] h-[18px] border-2 rounded-[5px] shrink-0 cursor-pointer flex items-center justify-center text-white ${task.done ? 'bg-accent border-accent' : 'border-border bg-transparent'}`}
                  onClick={() => toggleTask(task.id)}
                  aria-label="완료 토글"
                >
                  {task.done && <IconCheck width={11} height={11} />}
                </button>
                <div className={`flex-1 text-[0.875rem] ${task.done ? 'text-muted line-through' : 'text-primary'}`}>{task.text}</div>
                <div className={`text-[0.72rem] shrink-0 ${isSoon(task) ? 'text-warning font-semibold' : 'text-muted'}`}>{formatDue(task)}</div>
                <button type="button" className="icon-btn-danger" onClick={() => removeTask(task.id)} aria-label="할일 삭제"><IconTrash width={12} height={12} /></button>
              </div>
            ))}
          </div>
          <Pagination page={page} totalPages={totalPages} totalItems={total} onPageChange={setPage} />
        </Card>

        {/* 목표 */}
        <Card>
          <CardHeader>
            <CardTitle>목표</CardTitle>
            <div className="flex items-center gap-2">
              <Badge tone="success">{goals.length}건 진행중</Badge>
              <Button size="sm" onClick={() => setGoalModal({ open: true })}>목표 추가</Button>
            </div>
          </CardHeader>
          <div className="max-h-[504px] overflow-y-auto">
            {goals.length === 0 && <div className="px-5 py-4 text-[0.875rem] text-muted">목표가 없습니다.</div>}
            {goals.map((goal) => (
              <div className="px-5 py-4 border-b border-border-subtle last:border-b-0" key={goal.id}>
                <div className="flex justify-between items-center mb-2">
                  <span className="font-semibold text-[0.9rem] text-primary">{goal.name}</span>
                  <div className="flex items-center gap-1.5">
                    <span className="[font-family:var(--font-display)] font-bold text-accent mr-1">{goal.pct}%</span>
                    <button type="button" className="icon-btn-bordered" onClick={() => setGoalModal({ open: true, editing: goal })} aria-label="수정"><IconEdit width={13} height={13} /></button>
                    <button type="button" className="icon-btn-danger" onClick={() => removeGoal(goal.id)} aria-label="삭제"><IconTrash width={13} height={13} /></button>
                  </div>
                </div>
                <div className="track"><div className={`fill ${goal.tone}`} style={{ width: `${goal.pct}%` }} /></div>
                <div className="flex justify-between text-[0.78rem] text-muted mt-1.5">
                  <span>{formatGoalValue(goal.unit, goal.currentVal)}</span>
                  <span>목표 {formatGoalValue(goal.unit, goal.targetVal)}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* 할일 추가 모달 */}
      <AddTaskModal open={addModal} onClose={() => setAddModal(false)} onSaved={() => { setAddModal(false); reload(); }} />

      {/* 목표 추가/수정 모달 */}
      <GoalModal
        open={goalModal.open}
        editing={goalModal.editing}
        onClose={() => setGoalModal({ open: false })}
        onSaved={() => { setGoalModal({ open: false }); reload(); }}
      />

      {confirmElement}
    </AppShell>
  );
}

// 목표 추가/수정 모달
function GoalModal({ open, editing, onClose, onSaved }: { open: boolean; editing?: Goal; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState('');
  const [unit, setUnit] = useState<'won' | 'percent'>('won');
  const [currentVal, setCurrentVal] = useState('');
  const [targetVal, setTargetVal] = useState('');
  const [saving, setSaving] = useState(false);
  const { errors, setErrors, clearError, reset } = useFormErrors();

  useEffect(() => {
    if (!open) return;
    reset();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 모달 열릴 때 폼 초기화
    setName(editing?.name ?? '');
    setUnit(editing?.unit ?? 'won');
    setCurrentVal(editing ? String(editing.currentVal) : '');
    setTargetVal(editing ? String(editing.targetVal) : '');
  }, [open, editing]);

  function calcTone(pct: number): GoalTone {
    if (pct >= 75) return 'green';
    if (pct >= 40) return 'warning';
    return 'danger';
  }

  function validate() {
    const err: Record<string, string> = {};
    if (!name.trim()) err.name = '목표명을 입력하세요.';
    if (!currentVal || isNaN(Number(currentVal))) err.currentVal = '현재값을 입력하세요.';
    if (!targetVal || isNaN(Number(targetVal)) || Number(targetVal) <= 0) err.targetVal = '목표값을 입력하세요.';
    setErrors(err);
    return !Object.keys(err).length;
  }

  async function save() {
    if (!validate()) return;
    setSaving(true);
    const cur = Number(currentVal);
    const tgt = Number(targetVal);
    const pct = Math.min(100, Math.round((cur / tgt) * 100));
    const tone = calcTone(pct);
    const body = { name: name.trim(), unit, currentVal: cur, targetVal: tgt, pct, tone };
    try {
      if (editing) {
        await api.put(`/goals/${editing.id}`, body);
        notify.success('목표를 수정했습니다.');
      } else {
        await api.post('/goals', body);
        notify.added('목표');
      }
      onSaved();
    } catch {
      notify.saveFailed();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={editing ? '목표 수정' : '목표 추가'} footer={<ModalFooter onClose={onClose} onSave={save} saving={saving} />}>
      <Field label="목표명" required error={errors.name}>
        <input type="text" className={`input${errors.name ? ' is-invalid' : ''}`} placeholder="예: 비상금 적립" value={name} onChange={(e) => { setName(e.target.value); clearError('name'); }} />
      </Field>
      <Field label="단위" required>
        <select className="input" aria-label="단위" value={unit} onChange={(e) => setUnit(e.target.value as 'won' | 'percent')}>
          <option value="won">금액 (원)</option>
          <option value="percent">비율 (%)</option>
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-4 max-md:grid-cols-1">
        <Field label="현재값" required error={errors.currentVal}>
          <input type="number" className={`input${errors.currentVal ? ' is-invalid' : ''}`} placeholder="0" value={currentVal} onChange={(e) => { setCurrentVal(e.target.value); clearError('currentVal'); }} />
        </Field>
        <Field label="목표값" required error={errors.targetVal}>
          <input type="number" className={`input${errors.targetVal ? ' is-invalid' : ''}`} placeholder="0" value={targetVal} onChange={(e) => { setTargetVal(e.target.value); clearError('targetVal'); }} />
        </Field>
      </div>
    </Modal>
  );
}

// 할일 추가 모달
function AddTaskModal({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const [text, setText] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('normal');
  const [memo, setMemo] = useState('');
  const [saving, setSaving] = useState(false);
  const { errors, setErrors, clearError, reset } = useFormErrors();

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 모달 열릴 때 폼 초기화
    reset(); setText(''); setDueDate(''); setPriority('normal'); setMemo('');
  }, [open]);

  function validate() {
    const err: Record<string, string> = {};
    if (!text.trim()) err.text = '내용을 입력하세요.';
    setErrors(err);
    return !Object.keys(err).length;
  }

  async function save() {
    if (!validate()) return;
    setSaving(true);
    try {
      await api.post('/tasks', { text: text.trim(), dueDate: dueDate || undefined, priority, memo: memo || undefined });
      notify.added('할일');
      onSaved();
    } catch {
      notify.saveFailed();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="할일 추가" footer={<ModalFooter onClose={onClose} onSave={save} saving={saving} />}>
      <Field label="내용" required error={errors.text}>
        <input type="text" className={`input${errors.text ? ' is-invalid' : ''}`} placeholder="예: 자동차 보험 갱신" value={text} onChange={(e) => { setText(e.target.value); clearError('text'); }} />
      </Field>
      <div className="grid grid-cols-2 gap-4 max-md:grid-cols-1">
        <Field label="마감일"><input type="date" className="input" aria-label="마감일" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></Field>
        <Field label="우선순위" required>
          <select className="input" aria-label="우선순위" value={priority} onChange={(e) => setPriority(e.target.value as TaskPriority)}>
            {PRIORITY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </Field>
      </div>
      <Field label="메모 (선택)"><input type="text" className="input" placeholder="추가 메모" value={memo} onChange={(e) => setMemo(e.target.value)} /></Field>
    </Modal>
  );
}
