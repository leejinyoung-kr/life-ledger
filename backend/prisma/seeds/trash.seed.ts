/**
 * 휴지통 더미 — 여러 도메인에 soft-delete(deleted_at) 행을 심어 휴지통 통합 목록/복구 검증.
 * 주의: 각 도메인 시드는 deleteMany 로 전체를 비우므로, 이 시드는 SEEDS 배열의 "맨 마지막"에서 실행돼야
 *       삭제 더미가 살아남는다. deleted_at 경과일로 남은 보관일(30일 - 경과)을 다양하게 구성.
 */
import { d, type SeedFn } from './helpers';

const DAY = 24 * 60 * 60 * 1000;
// 현재에서 days 일 전 시각
const daysAgo = (days: number): Date => new Date(Date.now() - days * DAY);

// 한 사용자에게 도메인별 삭제 더미를 채운다
export const seedTrash: SeedFn = async (prisma, userId) => {
  let count = 0;

  // 가계부 — 1일 전 삭제 (남은 29일)
  await prisma.transaction.create({
    data: {
      user_id: userId, type: 'expense', date: d('2026-05-31'), title: '스타벅스',
      category: 'food', amount: 6500, pay_method: '카카오페이', memo: '실수 입력 삭제',
      deleted_at: daysAgo(1),
    },
  });
  count++;

  // 구독 — 4일 전 삭제 (26일)
  await prisma.subscription.create({
    data: {
      user_id: userId, name: '트위터 Blue', category: 'etc', amount: 11000, cycle: 'monthly',
      status: 'paused', next_payment_date: d('2026-06-20'), pay_method: '해외결제',
      deleted_at: daysAgo(4),
    },
  });
  count++;

  // 예적금 — 10일 전 삭제 (20일)
  await prisma.saving.create({
    data: {
      user_id: userId, bank: '신한은행', name: '해지한 자유적금', type: 'savings',
      interest_rate: 3.0, monthly_amount: 100000, start_date: d('2025-06-01'), balance: 1200000,
      deleted_at: daysAgo(10),
    },
  });
  count++;

  // 자산 — 22일 전 삭제 (8일)
  await prisma.asset.create({
    data: {
      user_id: userId, type: 'cash', name: '구 비상금 계좌', amount: 500000,
      deleted_at: daysAgo(22),
    },
  });
  count++;

  // 메모 — 28일 전 삭제 (2일, 임박)
  await prisma.note.create({
    data: {
      user_id: userId, title: '회의 메모 (4월)', body: '# 4월 회의\n\n- 정리 완료', tag: '기타',
      deleted_at: daysAgo(28),
    },
  });
  count++;

  // 할일 — 29일 전 삭제 (1일, 임박)
  await prisma.task.create({
    data: {
      user_id: userId, text: '구 면허 갱신 신청', priority: 'low', done: false,
      deleted_at: daysAgo(29),
    },
  });
  count++;

  return count;
};
