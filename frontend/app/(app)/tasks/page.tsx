'use client';

/**
 * 할일/목표 페이지.
 * 운영 todo(체크 토글)와 저축·자산 목표(진행바)를 2단으로 함께 추적한다.
 * 데이터는 백엔드 API(/tasks, /goals)와 연동한다.
 * 스타일: Tailwind + 공통 컴포넌트(Card/Button/Badge/Field). 진행바(track/fill)는 공통 globals.
 */
import { useCallback, useEffect, useState } from 'react';
import { notify } from '@/lib/toast';
import AppShell from '@/components/AppShell';
import Pagination, { LimitSelect } from '@/components/Pagination';
import Modal from '@/components/Modal';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Field, ModalFooter } from '@/components/ui/Field';
import { IconCheck, IconSearch } from '@/components/icons';
import { api } from '@/lib/api';
import {
  PRIORITY_OPTIONS, formatDue, isSoon, formatGoalValue,
  type Task, type Goal, type TaskPriority,
} from '@/lib/task';

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [addModal, setAddModal] = useState(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  // 할일/목표 조회
  const load = useCallback(async () => {
    try {
      const [t, g] = await Promise.all([
        api.get<Task[]>('/tasks'),
        api.get<Goal[]>('/goals'),
      ]);
      setTasks(t); setGoals(g); setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // 완료 토글 (낙관적 갱신 후 PUT)
  async function toggleTask(id: number) {
    const target = tasks.find((t) => t.id === id);
    if (!target) return;
    const next = !target.done;
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, done: next } : t)));
    try {
      await api.put(`/tasks/${id}`, { done: next });
      if (next) notify.success('할일을 완료했습니다.');
      load();
    } catch (e) {
      setError((e as Error).message);
      load();
    }
  }

  const searchedTasks = search.trim() ? tasks.filter((t) => t.text.toLowerCase().includes(search.toLowerCase())) : tasks;
  const doneCount = tasks.filter((t) => t.done).length;
  const totalPages = Math.ceil(searchedTasks.length / limit);
  const pagedTasks = searchedTasks.slice((page - 1) * limit, page * limit);

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
              <LimitSelect limit={limit} onLimitChange={(n) => { setLimit(n); setPage(1); }} />
              <Badge tone="neutral">{doneCount} / {tasks.length} 완료</Badge>
            </div>
          </CardHeader>
          <div>
            {pagedTasks.length === 0 && <div className="px-4 py-3 text-[0.875rem] text-muted">할 일이 없습니다.</div>}
            {pagedTasks.map((task) => (
              <div className="flex items-start gap-3 px-4 py-3 border-b border-border-subtle last:border-b-0 transition-colors hover:bg-surface" key={task.id}>
                <button
                  type="button"
                  className={`w-[18px] h-[18px] border-2 rounded-[5px] shrink-0 mt-px cursor-pointer flex items-center justify-center text-white ${task.done ? 'bg-accent border-accent' : 'border-border bg-transparent'}`}
                  onClick={() => toggleTask(task.id)}
                  aria-label="완료 토글"
                >
                  {task.done && <IconCheck width={11} height={11} />}
                </button>
                <div className={`flex-1 text-[0.875rem] ${task.done ? 'text-muted line-through' : 'text-primary'}`}>{task.text}</div>
                <div className={`text-[0.72rem] ${isSoon(task) ? 'text-warning font-semibold' : 'text-muted'}`}>{formatDue(task)}</div>
              </div>
            ))}
          </div>
          <Pagination page={page} totalPages={totalPages} totalItems={tasks.length} onPageChange={setPage} />
        </Card>

        {/* 목표 */}
        <Card>
          <CardHeader>
            <CardTitle>목표</CardTitle>
            <Badge tone="success">{goals.length}건 진행중</Badge>
          </CardHeader>
          <div>
            {goals.length === 0 && <div className="px-5 py-4 text-[0.875rem] text-muted">목표가 없습니다.</div>}
            {goals.map((goal) => (
              <div className="px-5 py-4 border-b border-border-subtle last:border-b-0" key={goal.id}>
                <div className="flex justify-between items-baseline mb-2">
                  <span className="font-semibold text-[0.9rem] text-primary">{goal.name}</span>
                  <span className="[font-family:var(--font-display)] font-bold text-accent">{goal.pct}%</span>
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
      <AddTaskModal open={addModal} onClose={() => setAddModal(false)} onSaved={() => { setAddModal(false); load(); }} />
    </AppShell>
  );
}

// 할일 추가 모달
function AddTaskModal({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const [text, setText] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('normal');
  const [memo, setMemo] = useState('');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    setErrors({}); setText(''); setDueDate(''); setPriority('normal'); setMemo('');
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
        <input type="text" className={`input${errors.text ? ' is-invalid' : ''}`} placeholder="예: 자동차 보험 갱신" value={text} onChange={(e) => { setText(e.target.value); setErrors((p) => { const n = { ...p }; delete n.text; return n; }); }} />
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
