/**
 * 캘린더 일정(CalendarEvent) 더미.
 * 구독 결제(pay)·입금/만기(due)·서류 만료(exp)·할일(task)을 2026-06 에 모아 그리드/다가오는 일정 검증.
 * 금액은 구독/자산 시드와 정합. 기준일 2026-06-02 — 다가오는 일정은 06-03 이후가 잡힌다.
 */
import type { CalEventType } from '@prisma/client';
import { d, type SeedFn } from './helpers';

type EventSeed = { date: string; type: CalEventType; title: string; memo: string | null };

const EVENTS: EventSeed[] = [
  { date: '2026-06-03', type: 'pay', title: '유튜브 프리미엄 ₩14,900', memo: null },
  { date: '2026-06-03', type: 'exp', title: 'Disney+ 체험 종료', memo: '자동결제 전환' },
  { date: '2026-06-04', type: 'pay', title: 'Disney+ ₩9,900', memo: null },
  { date: '2026-06-07', type: 'exp', title: '여권 갱신 서류 준비', memo: null },
  { date: '2026-06-09', type: 'exp', title: '카카오뱅크 비밀번호 변경', memo: '유출 의심' },
  { date: '2026-06-10', type: 'pay', title: 'iCloud+ ₩3,300', memo: null },
  { date: '2026-06-11', type: 'task', title: '부산 출장 KTX 예매', memo: null },
  { date: '2026-06-12', type: 'pay', title: 'ChatGPT Plus ₩28,000', memo: '해외결제' },
  { date: '2026-06-13', type: 'exp', title: '클래스101 체험 종료', memo: '자동결제 전환' },
  { date: '2026-06-14', type: 'pay', title: 'Notion Plus ₩11,000', memo: '해외결제' },
  { date: '2026-06-15', type: 'pay', title: '스포티파이 ₩10,900', memo: null },
  { date: '2026-06-16', type: 'task', title: '자동차 보험 갱신', memo: '비교 견적' },
  { date: '2026-06-18', type: 'pay', title: '멜론 ₩10,900', memo: null },
  { date: '2026-06-20', type: 'pay', title: '쿠팡 와우 ₩7,890', memo: null },
  { date: '2026-06-20', type: 'due', title: '26주 적금 만기 ₩1,600,000', memo: '재예치 검토' },
  { date: '2026-06-22', type: 'pay', title: 'GitHub Copilot ₩13,000', memo: '해외결제' },
  { date: '2026-06-25', type: 'due', title: '월급 입금 ₩3,200,000', memo: null },
  { date: '2026-06-26', type: 'pay', title: '뉴욕타임스 ₩5,500', memo: '해외결제' },
  { date: '2026-06-28', type: 'pay', title: '아마존 프라임 ₩5,900', memo: '해외결제' },
  { date: '2026-06-28', type: 'due', title: '비상금 예금 만기 ₩3,000,000', memo: null },
  { date: '2026-06-29', type: 'pay', title: '넷플릭스 ₩17,000', memo: null },
  { date: '2026-07-01', type: 'due', title: '청약저축 납입 ₩200,000', memo: null },
  { date: '2026-07-24', type: 'exp', title: '여권 갱신 만료 (D-day)', memo: '신청 완료 필요' },
];

// 한 사용자에게 캘린더 일정 더미를 채운다 (기존 행 제거 후 재삽입 → idempotent)
export const seedCalendar: SeedFn = async (prisma, userId) => {
  await prisma.calendarEvent.deleteMany({ where: { user_id: userId } });

  for (const e of EVENTS) {
    await prisma.calendarEvent.create({
      data: { user_id: userId, date: d(e.date), type: e.type, title: e.title, memo: e.memo },
    });
  }
  return EVENTS.length;
};
