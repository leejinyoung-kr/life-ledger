/**
 * 할일(Task) + 목표(Goal) 더미.
 * 할일은 우선순위·마감일·완료여부 섞어서, 목표는 won/percent 단위 + 진행바색(green/warning/danger).
 * 기준일 2026-06-02 — 마감 임박(D-1~D-14) 검증용 날짜 포함.
 */
import type { GoalTone, TaskPriority } from '@prisma/client';
import { d, type SeedFn } from './helpers';

type TaskSeed = {
  text: string;
  dueDate: string | null;
  priority: TaskPriority;
  memo: string | null;
  done: boolean;
};

const TASKS: TaskSeed[] = [
  { text: '5월 카드값 확인 후 이체', dueDate: '2026-06-03', priority: 'high', memo: null, done: false },
  { text: 'GitHub 비밀번호 변경 (재사용 경고)', dueDate: '2026-06-05', priority: 'high', memo: '재사용 비번 교체', done: false },
  { text: '자동차 보험 갱신 (만기 6/16)', dueDate: '2026-06-16', priority: 'normal', memo: null, done: false },
  { text: '여권 갱신 서류 준비', dueDate: '2026-07-30', priority: 'low', memo: '사진 + 신청서', done: false },
  { text: '넷플릭스 요금제 변경', dueDate: null, priority: 'normal', memo: null, done: true },
  { text: '4월 가계부 정산', dueDate: null, priority: 'normal', memo: null, done: true },
  { text: '전세 계약서 스캔 업로드', dueDate: null, priority: 'low', memo: null, done: true },
];

type GoalSeed = {
  name: string;
  unit: string;
  currentVal: number;
  targetVal: number;
  pct: number;
  tone: GoalTone;
};

const GOALS: GoalSeed[] = [
  { name: '비상금 1천만원 모으기', unit: 'won', currentVal: 7400000, targetVal: 10000000, pct: 74, tone: 'green' },
  { name: '전세금 5천만원', unit: 'won', currentVal: 23000000, targetVal: 50000000, pct: 46, tone: 'green' },
  { name: '투자 비중 40% 달성', unit: 'percent', currentVal: 38, targetVal: 40, pct: 95, tone: 'warning' },
  { name: '월 지출 80만원 이하', unit: 'won', currentVal: 842300, targetVal: 800000, pct: 88, tone: 'danger' },
];

// 한 사용자에게 할일/목표 더미를 채운다 (기존 행 제거 후 재삽입 → idempotent)
export const seedTasks: SeedFn = async (prisma, userId) => {
  await prisma.task.deleteMany({ where: { user_id: userId } });
  await prisma.goal.deleteMany({ where: { user_id: userId } });

  for (const t of TASKS) {
    await prisma.task.create({
      data: {
        user_id: userId,
        text: t.text,
        due_date: t.dueDate ? d(t.dueDate) : null,
        priority: t.priority,
        memo: t.memo,
        done: t.done,
        done_at: t.done ? new Date() : null,
      },
    });
  }

  for (const g of GOALS) {
    await prisma.goal.create({
      data: {
        user_id: userId,
        name: g.name,
        unit: g.unit,
        current_val: g.currentVal,
        target_val: g.targetVal,
        pct: g.pct,
        tone: g.tone,
      },
    });
  }

  return TASKS.length + GOALS.length;
};
