/**
 * 구독(Subscription) 더미.
 * 카테고리·주기·상태·결제수단을 다양하게. 미사용 의심(마지막 사용 30일 초과/체험 미사용)
 * 과 다음 결제 임박(D-day) 검증용 데이터를 포함한다. 데이터가 늘면 아래 배열만 추가.
 */
import type { SubscriptionCycle, SubscriptionStatus } from '@prisma/client';
import { dAt, dsNext, dsPast, inDays, type SeedFn } from './helpers';

type SubSeed = {
  name: string;
  category: string; // ott/music/cloud/shopping/ai/etc
  amount: number;
  cycle: SubscriptionCycle;
  status: SubscriptionStatus;
  nextPaymentDate: string;
  payMethod: string; // 코드 관리 pay_method 코드 (2026-10-20 부터 이름 대신 코드)
  lastUsedAt: string | null;
  memo: string | null;
  trialEndsInDays?: number; // 체험 — 종료(첫 결제)가 오늘부터 며칠 뒤인지. 종료 임박 배너가 늘 보이게 날짜 대신 간격으로 적는다
};

const SUBSCRIPTIONS: SubSeed[] = [
  { name: '넷플릭스', category: 'ott', amount: 17000, cycle: 'monthly', status: 'active', nextPaymentDate: '2026-06-29', payMethod: 'shinhan_card', lastUsedAt: '2026-06-01', memo: '4K 프리미엄' },
  { name: '유튜브 프리미엄', category: 'ott', amount: 14900, cycle: 'monthly', status: 'active', nextPaymentDate: '2026-06-04', payMethod: 'kakao_pay', lastUsedAt: '2026-06-02', memo: '광고 제거' },
  { name: '스포티파이', category: 'music', amount: 10900, cycle: 'monthly', status: 'active', nextPaymentDate: '2026-06-15', payMethod: 'shinhan_card', lastUsedAt: '2026-04-21', memo: '미사용 의심' },
  { name: '쿠팡 와우', category: 'shopping', amount: 7890, cycle: 'monthly', status: 'active', nextPaymentDate: '2026-06-20', payMethod: 'shinhan_card', lastUsedAt: '2026-05-30', memo: null },
  { name: 'iCloud+ 200GB', category: 'cloud', amount: 3300, cycle: 'monthly', status: 'active', nextPaymentDate: '2026-06-10', payMethod: 'shinhan_card', lastUsedAt: '2026-06-01', memo: null },
  { name: 'ChatGPT Plus', category: 'ai', amount: 28000, cycle: 'monthly', status: 'active', nextPaymentDate: '2026-06-12', payMethod: 'foreign', lastUsedAt: '2026-06-01', memo: '$20 해외결제' },
  { name: 'Disney+', category: 'ott', amount: 9900, cycle: 'monthly', status: 'trial', nextPaymentDate: '2026-06-04', payMethod: 'shinhan_card', lastUsedAt: null, memo: '무료 체험 — 종료 임박', trialEndsInDays: 3 },
  { name: 'Adobe Creative Cloud', category: 'software', amount: 660000, cycle: 'yearly', status: 'active', nextPaymentDate: '2026-09-01', payMethod: 'shinhan_card', lastUsedAt: '2026-05-20', memo: '연간 결제' },
  { name: '윌라 오디오북', category: 'etc', amount: 9900, cycle: 'monthly', status: 'paused', nextPaymentDate: '2026-07-01', payMethod: 'bank_transfer', lastUsedAt: '2026-02-10', memo: '일시정지' },
  { name: '멜론', category: 'music', amount: 10900, cycle: 'monthly', status: 'active', nextPaymentDate: '2026-06-18', payMethod: 'kakao_pay', lastUsedAt: '2026-06-08', memo: '스트리밍' },
  { name: 'GitHub Copilot', category: 'ai', amount: 13000, cycle: 'monthly', status: 'active', nextPaymentDate: '2026-06-22', payMethod: 'foreign', lastUsedAt: '2026-06-09', memo: '$10 해외결제' },
  { name: 'Notion Plus', category: 'software', amount: 11000, cycle: 'monthly', status: 'active', nextPaymentDate: '2026-06-14', payMethod: 'foreign', lastUsedAt: '2026-06-07', memo: '문서 관리' },
  { name: 'Microsoft 365', category: 'software', amount: 89000, cycle: 'yearly', status: 'active', nextPaymentDate: '2027-01-15', payMethod: 'shinhan_card', lastUsedAt: '2026-05-28', memo: 'Office 패밀리' },
  { name: '왓챠', category: 'ott', amount: 7900, cycle: 'monthly', status: 'paused', nextPaymentDate: '2026-07-05', payMethod: 'shinhan_card', lastUsedAt: '2026-03-15', memo: '안 봐서 정지' },
  { name: '뉴욕타임스', category: 'news', amount: 5500, cycle: 'monthly', status: 'active', nextPaymentDate: '2026-06-26', payMethod: 'foreign', lastUsedAt: '2026-04-30', memo: '미사용 의심' },
  { name: '클래스101', category: 'etc', amount: 19900, cycle: 'monthly', status: 'trial', nextPaymentDate: '2026-06-13', payMethod: 'kakao_pay', lastUsedAt: null, memo: '무료 체험 — 종료 임박', trialEndsInDays: 12 },
  { name: '아마존 프라임', category: 'shopping', amount: 5900, cycle: 'monthly', status: 'active', nextPaymentDate: '2026-06-28', payMethod: 'foreign', lastUsedAt: '2026-05-12', memo: null },
];

// 한 사용자에게 구독 더미를 채운다 (기존 행 제거 후 재삽입 → idempotent)
export const seedSubscriptions: SeedFn = async (prisma, userId) => {
  await prisma.subscription.deleteMany({ where: { user_id: userId } });

  for (const s of SUBSCRIPTIONS) {
    const next = s.trialEndsInDays != null ? inDays(s.trialEndsInDays) : dsNext(s.nextPaymentDate, s.cycle === 'yearly' ? 12 : 1);
    // 원래 결제일은 처음 적은 날 — 체험은 종료일이 곧 첫 결제일
    const billingDay = s.trialEndsInDays != null ? Number(next.slice(8)) : Number(s.nextPaymentDate.slice(8));
    await prisma.subscription.create({
      data: {
        user_id: userId,
        name: s.name,
        category: s.category,
        amount: s.amount,
        cycle: s.cycle,
        status: s.status,
        next_payment_date: dAt(next),
        billing_day: billingDay,
        pay_method: s.payMethod,
        last_used_at: s.lastUsedAt ? dAt(dsPast(s.lastUsedAt)) : null,
        memo: s.memo,
      },
    });
  }
  return SUBSCRIPTIONS.length;
};
