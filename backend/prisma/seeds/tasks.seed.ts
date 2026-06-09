/**
 * 할일(Task) + 목표(Goal) 더미.
 * 할일은 우선순위·마감일·완료여부 섞어서, 목표는 won/percent 단위 + 진행바색(green/warning/danger).
 * 기준일 2026-06-06 — 마감 임박(D-1~D-14) 검증용 날짜 포함.
 * tone 기준: pct >= 75 → green / pct >= 40 → warning / pct < 40 → danger
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
  { text: '6월 카드값 확인 후 이체', dueDate: '2026-06-08', priority: 'high', memo: null, done: false },
  { text: '카카오뱅크 비밀번호 변경 (유출 의심)', dueDate: '2026-06-09', priority: 'high', memo: '다크웹 유출 경고', done: false },
  { text: 'GitHub 비밀번호 변경 (재사용 경고)', dueDate: '2026-06-10', priority: 'high', memo: '재사용 비번 교체', done: false },
  { text: '부산 출장 KTX 예매', dueDate: '2026-06-11', priority: 'normal', memo: '왕복', done: false },
  { text: 'Disney+ 체험 해지 여부 결정', dueDate: '2026-06-13', priority: 'normal', memo: '자동결제 전환 전', done: false },
  { text: '자동차 보험 갱신 (만기 6/16)', dueDate: '2026-06-16', priority: 'normal', memo: '비교 견적', done: false },
  { text: '26주 적금 만기 재예치 알아보기', dueDate: '2026-06-20', priority: 'normal', memo: null, done: false },
  { text: '치과 정기검진 예약', dueDate: '2026-06-25', priority: 'low', memo: null, done: false },
  { text: '여권 갱신 서류 준비', dueDate: '2026-07-30', priority: 'low', memo: '사진 + 신청서', done: false },
  { text: '넷플릭스 요금제 변경', dueDate: null, priority: 'normal', memo: null, done: true },
  { text: '5월 가계부 정산', dueDate: null, priority: 'normal', memo: null, done: true },
  { text: '전세 계약서 스캔 업로드', dueDate: null, priority: 'low', memo: null, done: true },
  { text: '비상금 계좌 분리 이체', dueDate: null, priority: 'normal', memo: null, done: true },
  { text: '2FA 백업코드 출력 보관', dueDate: null, priority: 'high', memo: 'Google 계정', done: true },
];

type GoalSeed = {
  name: string;
  unit: 'won' | 'percent';
  currentVal: number;
  targetVal: number;
  pct: number;
  tone: GoalTone;
};

const GOALS: GoalSeed[] = [
  { name: '비상금 1천만원 모으기',      unit: 'won',     currentVal: 7_400_000,  targetVal: 10_000_000, pct: 74, tone: 'warning' },
  { name: '전세금 5천만원',             unit: 'won',     currentVal: 23_000_000, targetVal: 50_000_000, pct: 46, tone: 'warning' },
  { name: '투자 비중 40% 달성',         unit: 'percent', currentVal: 38,         targetVal: 40,         pct: 95, tone: 'green'   },
  { name: '월 생활비 150만원 이하',     unit: 'won',     currentVal: 1_180_000,  targetVal: 1_500_000,  pct: 79, tone: 'green'   },
  { name: '여행 자금 300만원',          unit: 'won',     currentVal: 800_000,    targetVal: 3_000_000,  pct: 27, tone: 'danger'  },
  { name: '연간 저축률 30% 이상',       unit: 'percent', currentVal: 22,         targetVal: 30,         pct: 73, tone: 'warning' },
  { name: '주택청약 1천만원 납입',      unit: 'won',     currentVal: 9_200_000,  targetVal: 10_000_000, pct: 92, tone: 'green'   },
  { name: '순자산 1억 달성',            unit: 'won',     currentVal: 82_200_000, targetVal: 100_000_000, pct: 82, tone: 'green'   },
  { name: '부채 2천만원 이하로',        unit: 'won',     currentVal: 7_000_000,  targetVal: 7_000_000,  pct: 64, tone: 'warning' },
  { name: '구독료 월 10만원 이하',      unit: 'won',     currentVal: 95_000,     targetVal: 100_000,    pct: 88, tone: 'green'   },
  { name: '독서 연 24권',               unit: 'percent', currentVal: 9,          targetVal: 24,         pct: 38, tone: 'danger'  },
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
