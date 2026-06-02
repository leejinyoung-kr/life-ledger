'use client';

/**
 * 할일/목표 페이지.
 * 운영 todo(체크 토글)와 저축·자산 목표(진행바)를 2단으로 함께 추적한다.
 * 데이터는 백엔드 API(/tasks, /goals)와 연동한다.
 */
import { useCallback, useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import AppShell from '@/components/AppShell';
import Modal from '@/components/Modal';
import { IconCheck } from '@/components/icons';
import { api } from '@/lib/api';
import {
  PRIORITY_OPTIONS, formatDue, isSoon, formatGoalValue,
  type Task, type Goal, type TaskPriority,
} from '@/lib/task';

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [addModal, setAddModal] = useState(false);

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
      load();
    } catch (e) {
      setError((e as Error).message);
      load();
    }
  }

  const doneCount = tasks.filter((t) => t.done).length;

  return (
    <AppShell
      activePath="/tasks"
      topbarLabel="할일 / 목표"
      actionLabel="할일 추가"
      onAction={() => setAddModal(true)}
    >
      <div className="page-header">
        <h1 className="page-title">할일 / 목표</h1>
        <p className="page-subtitle">운영 todo 와 저축·자산 목표를 함께 추적합니다.</p>
      </div>

      {error && <p className="ledger-note is-error">⚠️ {error}</p>}

      <div className="tg-layout">
        {/* 할 일 */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">할 일</span>
            <span className="badge badge-neutral">{doneCount} / {tasks.length} 완료</span>
          </div>
          <div className="card-list">
            {tasks.length === 0 && <div className="task-item"><div className="task-text td-muted">할 일이 없습니다.</div></div>}
            {tasks.map((task) => (
              <div className={`task-item${task.done ? ' done' : ''}`} key={task.id}>
                <button type="button" className={`task-check${task.done ? ' done' : ''}`} onClick={() => toggleTask(task.id)} aria-label="완료 토글">
                  {task.done && <IconCheck width={11} height={11} />}
                </button>
                <div className="task-text">{task.text}</div>
                <div className={`task-due${isSoon(task) ? ' soon' : ''}`}>{formatDue(task)}</div>
              </div>
            ))}
          </div>
        </div>

        {/* 목표 */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">목표</span>
            <span className="badge badge-success">{goals.length}건 진행중</span>
          </div>
          <div className="card-list">
            {goals.length === 0 && <div className="goal-card td-muted">목표가 없습니다.</div>}
            {goals.map((goal) => (
              <div className="goal-card" key={goal.id}>
                <div className="goal-top">
                  <span className="goal-name">{goal.name}</span>
                  <span className="goal-pct">{goal.pct}%</span>
                </div>
                <div className="track"><div className={`fill ${goal.tone}`} style={{ width: `${goal.pct}%` } as CSSProperties} /></div>
                <div className="goal-amt">
                  <span>{formatGoalValue(goal.unit, goal.currentVal)}</span>
                  <span>목표 {formatGoalValue(goal.unit, goal.targetVal)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
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
  const [err, setErr] = useState<string | null>(null);

  // 모달 열릴 때 폼 초기화
  useEffect(() => {
    if (!open) return;
    setErr(null); setText(''); setDueDate(''); setPriority('normal'); setMemo('');
  }, [open]);

  async function save() {
    if (!text.trim()) { setErr('내용을 입력하세요.'); return; }
    setSaving(true); setErr(null);
    try {
      await api.post('/tasks', {
        text: text.trim(),
        dueDate: dueDate || undefined,
        priority,
        memo: memo || undefined,
      });
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
      title="할일 추가"
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>취소</button>
          <button type="button" className="btn btn-primary" onClick={save} disabled={saving}>{saving ? '저장 중...' : '저장'}</button>
        </>
      }
    >
      {err && <p className="input-error">⚠️ {err}</p>}
      <Field label="내용"><input type="text" className="input" placeholder="예: 자동차 보험 갱신" value={text} onChange={(e) => setText(e.target.value)} /></Field>
      <div className="form-grid-2">
        <Field label="마감일"><input type="date" className="input" aria-label="마감일" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></Field>
        <Field label="우선순위">
          <select className="input" aria-label="우선순위" value={priority} onChange={(e) => setPriority(e.target.value as TaskPriority)}>
            {PRIORITY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
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
