'use client';

/**
 * 할일/목표 페이지.
 * 운영 todo(체크 토글)와 저축·자산 목표(진행바)를 2단으로 함께 추적한다.
 * 공통 레이아웃(AppShell)·모달(Modal)을 재사용하고 데이터는 더미로 채운다.
 */
import { useState, type ReactNode } from 'react';
import AppShell from '@/components/AppShell';
import Modal from '@/components/Modal';
import { IconCheck } from '@/components/icons';

interface Task { id: number; text: string; due: string; soon?: boolean; done: boolean; }
interface Goal { name: string; pct: number; fill: 'green' | 'warning' | 'danger'; cur: string; target: string; }

// ── 더미 데이터 (TODO: GET /api/v1/tasks) ───────────────────────
const INITIAL_TASKS: Task[] = [
  { id: 1, text: '자동차 보험 갱신 (만기 6/15)', due: 'D-14', soon: true, done: false },
  { id: 2, text: 'GitHub 비밀번호 변경 (재사용 경고)', due: 'D-3', soon: true, done: false },
  { id: 3, text: '여권 갱신 서류 준비', due: 'D-58', done: false },
  { id: 4, text: '5월 카드값 확인 후 이체', due: '내일', soon: true, done: false },
  { id: 5, text: '넷플릭스 요금제 변경', due: '완료', done: true },
  { id: 6, text: '4월 가계부 정산', due: '완료', done: true },
  { id: 7, text: '전세 계약서 스캔 업로드', due: '완료', done: true },
];

// 목표 — TODO: GET /api/v1/goals
const GOALS: Goal[] = [
  { name: '비상금 1천만원 모으기', pct: 74, fill: 'green', cur: '₩7,400,000', target: '목표 ₩10,000,000' },
  { name: '전세금 5천만원', pct: 46, fill: 'green', cur: '₩23,000,000', target: '목표 ₩50,000,000' },
  { name: '투자 비중 40% 달성', pct: 95, fill: 'warning', cur: '38%', target: '목표 40%' },
  { name: '월 지출 80만원 이하', pct: 88, fill: 'danger', cur: '₩842,300', target: '목표 ₩800,000' },
];

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>(INITIAL_TASKS);
  const [addModal, setAddModal] = useState(false);

  // 할 일 완료 토글. TODO: PATCH /api/v1/tasks/:id
  function toggleTask(id: number) {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));
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

      <div className="tg-layout">
        {/* 할 일 */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">할 일</span>
            <span className="badge badge-neutral">{doneCount} / {tasks.length} 완료</span>
          </div>
          <div className="card-list">
            {tasks.map((task) => (
              <div className={`task-item${task.done ? ' done' : ''}`} key={task.id}>
                <button type="button" className={`task-check${task.done ? ' done' : ''}`} onClick={() => toggleTask(task.id)} aria-label="완료 토글">
                  {task.done && <IconCheck width={11} height={11} />}
                </button>
                <div className="task-text">{task.text}</div>
                <div className={`task-due${task.soon ? ' soon' : ''}`}>{task.due}</div>
              </div>
            ))}
          </div>
        </div>

        {/* 목표 */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">목표</span>
            <span className="badge badge-success">{GOALS.length}건 진행중</span>
          </div>
          <div className="card-list">
            {GOALS.map((goal) => (
              <div className="goal-card" key={goal.name}>
                <div className="goal-top">
                  <span className="goal-name">{goal.name}</span>
                  <span className="goal-pct">{goal.pct}%</span>
                </div>
                <div className="track"><div className={`fill ${goal.fill}`} style={{ width: `${goal.pct}%` }} /></div>
                <div className="goal-amt"><span>{goal.cur}</span><span>{goal.target}</span></div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 할일 추가 모달 */}
      <Modal
        open={addModal}
        onClose={() => setAddModal(false)}
        title="할일 추가"
        footer={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setAddModal(false)}>취소</button>
            {/* TODO: API 연동 — 저장(POST) 처리 */}
            <button type="button" className="btn btn-primary">저장</button>
          </>
        }
      >
        <Field label="내용"><input type="text" className="input" placeholder="예: 자동차 보험 갱신" /></Field>
        <div className="form-grid-2">
          <Field label="마감일"><input type="date" className="input" /></Field>
          <Field label="우선순위">
            <select className="input" aria-label="우선순위"><option>보통</option><option>높음</option><option>낮음</option></select>
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
