/**
 * 캘린더 직접 일정(CalendarEvent) 더미.
 * 구독 결제 · 예적금 만기는 다른 테이블에서 연동되는 가상 일정이라, 여기는 사용자가 직접 넣는 일정만 —
 * 할일 · 만료 · 반복(매월 · 매년)을 섞고, 오늘과의 간격으로 적어 달력에 늘 이번 달 일정이 보이게 한다.
 */
import type { CalEventType, CalRecurFreq } from '@prisma/client';
import { dAt, ds, inDays, type SeedFn } from './helpers';

type EventSeed = {
  title: string;
  type: CalEventType;
  date: string; // 이미 실행일 기준인 'YYYY-MM-DD'
  memo?: string;
  recurFreq?: CalRecurFreq;
};

const EVENTS = (): EventSeed[] => [
  { title: '치과 정기검진', type: 'task', date: inDays(-3), memo: '스케일링 포함' },
  { title: '연말정산 서류 챙기기', type: 'task', date: inDays(5), memo: '의료비 · 기부금 영수증' },
  { title: '자동차 보험 갱신', type: 'exp', date: inDays(18), memo: '다이렉트 견적 비교' },
  { title: '여권 만료', type: 'exp', date: inDays(75), memo: '6개월 전부터 재발급 가능' },
  { title: '전세 계약 만기', type: 'due', date: inDays(140), memo: '2개월 전 집주인에게 연락' },
  // 반복 — 첫 회차를 과거에 두고 매월 · 매년 돌린다
  { title: '아파트 관리비 납부', type: 'pay', date: ds('2026-01-25'), recurFreq: 'monthly' },
  { title: '부모님 결혼기념일', type: 'task', date: ds('2025-06-20'), memo: '꽃 · 식사 예약', recurFreq: 'yearly' },
];

// 한 사용자에게 직접 일정 더미를 채운다 (기존 행 제거 후 재삽입 → idempotent)
export const seedCalendarEvents: SeedFn = async (prisma, userId) => {
  await prisma.calendarEvent.deleteMany({ where: { user_id: userId } });

  const rows = EVENTS();
  await prisma.calendarEvent.createMany({
    data: rows.map((e) => ({
      user_id: userId,
      title: e.title,
      type: e.type,
      date: dAt(e.date),
      memo: e.memo ?? null,
      recur_freq: e.recurFreq ?? 'none',
    })),
  });
  return rows.length;
};
