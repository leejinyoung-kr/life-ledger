/**
 * 할일/목표 공통 타입 · 라벨맵 · 포맷 유틸.
 * 백엔드 응답 DTO(/tasks, /goals)와 1:1 대응한다. daysUntil 은 lib/finance 와 공유.
 */
import { daysUntil } from '@/lib/finance';

export type TaskPriority = 'low' | 'normal' | 'high';
export type GoalTone = 'green' | 'warning' | 'danger';

export interface Task {
  id: number;
  text: string;
  dueDate: string | null; // YYYY-MM-DD
  priority: TaskPriority;
  memo: string | null;
  done: boolean;
}

export interface Goal {
  id: number;
  name: string;
  unit: 'won' | 'percent';
  currentVal: number;
  targetVal: number;
  pct: number;
  tone: GoalTone;
}

export const PRIORITY_LABEL: Record<TaskPriority, string> = {
  low: '낮음',
  normal: '보통',
  high: '높음',
};

export const PRIORITY_OPTIONS: { value: TaskPriority; label: string }[] = [
  { value: 'normal', label: '보통' },
  { value: 'high', label: '높음' },
  { value: 'low', label: '낮음' },
];

// 마감 표시 — 완료/오늘/내일/D-n/지남
export function formatDue(task: Task): string {
  if (task.done) return '완료';
  if (!task.dueDate) return '';
  const n = daysUntil(task.dueDate);
  if (n === null) return '';
  if (n < 0) return `${-n}일 지남`;
  if (n === 0) return '오늘';
  if (n === 1) return '내일';
  return `D-${n}`;
}

// 마감 임박 여부 (미완료 + 7일 이내)
export function isSoon(task: Task): boolean {
  if (task.done || !task.dueDate) return false;
  const n = daysUntil(task.dueDate);
  return n !== null && n >= 0 && n <= 7;
}

// 단위별 값 표기 (won → ₩1,000,000 / percent → 38%)
export function formatGoalValue(unit: 'won' | 'percent', val: number): string {
  return unit === 'percent' ? `${val}%` : `₩${val.toLocaleString('ko-KR')}`;
}
