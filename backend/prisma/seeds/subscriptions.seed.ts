/**
 * 구독(Subscription) 더미.
 * 카테고리·주기·상태·결제수단을 다양하게. 미사용 의심(마지막 사용 30일 초과/체험 미사용)
 * 과 다음 결제 임박(D-day) 검증용 데이터를 포함한다. 데이터가 늘면 아래 배열만 추가.
 */
import type { SubscriptionCycle, SubscriptionStatus } from '@prisma/client';
import { d, type SeedFn } from './helpers';

type SubSeed = {
  name: string;
  category: string; // ott/music/cloud/shopping/ai/etc
  amount: number;
  cycle: SubscriptionCycle;
  status: SubscriptionStatus;
  nextPaymentDate: string;
  payMethod: string;
  lastUsedAt: string | null;
  memo: string | null;
};

const SUBSCRIPTIONS: SubSeed[] = [
  { name: '넷플릭스', category: 'ott', amount: 17000, cycle: 'monthly', status: 'active', nextPaymentDate: '2026-06-29', payMethod: '신한카드', lastUsedAt: '2026-06-01', memo: '4K 프리미엄' },
  { name: '유튜브 프리미엄', category: 'ott', amount: 14900, cycle: 'monthly', status: 'active', nextPaymentDate: '2026-06-04', payMethod: '카카오페이', lastUsedAt: '2026-06-02', memo: '광고 제거' },
  { name: '스포티파이', category: 'music', amount: 10900, cycle: 'monthly', status: 'active', nextPaymentDate: '2026-06-15', payMethod: '신한카드', lastUsedAt: '2026-04-21', memo: '미사용 의심' },
  { name: '쿠팡 와우', category: 'shopping', amount: 7890, cycle: 'monthly', status: 'active', nextPaymentDate: '2026-06-20', payMethod: '쿠페이', lastUsedAt: '2026-05-30', memo: null },
  { name: 'iCloud+ 200GB', category: 'cloud', amount: 3300, cycle: 'monthly', status: 'active', nextPaymentDate: '2026-06-10', payMethod: '신한카드', lastUsedAt: '2026-06-01', memo: null },
  { name: 'ChatGPT Plus', category: 'ai', amount: 28000, cycle: 'monthly', status: 'active', nextPaymentDate: '2026-06-12', payMethod: '해외결제', lastUsedAt: '2026-06-01', memo: '$20 해외결제' },
  { name: 'Disney+', category: 'ott', amount: 9900, cycle: 'monthly', status: 'trial', nextPaymentDate: '2026-06-04', payMethod: '신한카드', lastUsedAt: null, memo: '무료 체험 — 종료 임박' },
  { name: 'Adobe Creative Cloud', category: 'software', amount: 660000, cycle: 'yearly', status: 'active', nextPaymentDate: '2026-09-01', payMethod: '신한카드', lastUsedAt: '2026-05-20', memo: '연간 결제' },
  { name: '윌라 오디오북', category: 'etc', amount: 9900, cycle: 'monthly', status: 'paused', nextPaymentDate: '2026-07-01', payMethod: '계좌이체', lastUsedAt: '2026-02-10', memo: '일시정지' },
  { name: '멜론', category: 'music', amount: 10900, cycle: 'monthly', status: 'active', nextPaymentDate: '2026-06-18', payMethod: '카카오페이', lastUsedAt: '2026-06-08', memo: '스트리밍' },
  { name: 'GitHub Copilot', category: 'ai', amount: 13000, cycle: 'monthly', status: 'active', nextPaymentDate: '2026-06-22', payMethod: '해외결제', lastUsedAt: '2026-06-09', memo: '$10 해외결제' },
  { name: 'Notion Plus', category: 'software', amount: 11000, cycle: 'monthly', status: 'active', nextPaymentDate: '2026-06-14', payMethod: '해외결제', lastUsedAt: '2026-06-07', memo: '문서 관리' },
  { name: 'Microsoft 365', category: 'software', amount: 89000, cycle: 'yearly', status: 'active', nextPaymentDate: '2027-01-15', payMethod: '신한카드', lastUsedAt: '2026-05-28', memo: 'Office 패밀리' },
  { name: '왓챠', category: 'ott', amount: 7900, cycle: 'monthly', status: 'paused', nextPaymentDate: '2026-07-05', payMethod: '신한카드', lastUsedAt: '2026-03-15', memo: '안 봐서 정지' },
  { name: '뉴욕타임스', category: 'news', amount: 5500, cycle: 'monthly', status: 'active', nextPaymentDate: '2026-06-26', payMethod: '해외결제', lastUsedAt: '2026-04-30', memo: '미사용 의심' },
  { name: '클래스101', category: 'etc', amount: 19900, cycle: 'monthly', status: 'trial', nextPaymentDate: '2026-06-13', payMethod: '카카오페이', lastUsedAt: null, memo: '무료 체험 — 종료 임박' },
  { name: '아마존 프라임', category: 'shopping', amount: 5900, cycle: 'monthly', status: 'active', nextPaymentDate: '2026-06-28', payMethod: '해외결제', lastUsedAt: '2026-05-12', memo: null },
];

// 한 사용자에게 구독 더미를 채운다 (기존 행 제거 후 재삽입 → idempotent)
export const seedSubscriptions: SeedFn = async (prisma, userId) => {
  await prisma.subscription.deleteMany({ where: { user_id: userId } });

  for (const s of SUBSCRIPTIONS) {
    await prisma.subscription.create({
      data: {
        user_id: userId,
        name: s.name,
        category: s.category,
        amount: s.amount,
        cycle: s.cycle,
        status: s.status,
        next_payment_date: d(s.nextPaymentDate),
        billing_day: d(s.nextPaymentDate).getUTCDate(),
        pay_method: s.payMethod,
        last_used_at: s.lastUsedAt ? d(s.lastUsedAt) : null,
        memo: s.memo,
      },
    });
  }
  return SUBSCRIPTIONS.length;
};
