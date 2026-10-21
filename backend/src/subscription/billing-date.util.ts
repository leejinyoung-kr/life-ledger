import { SubscriptionCycle } from '@prisma/client';

// 결제일 한 주기 뒤 — 월/연은 원래 결제일(billingDay)로 맞추고 그 달에 없으면 말일 (31일 → 2/28 → 3/31)
export function addCycle(d: Date, cycle: SubscriptionCycle, billingDay: number): Date {
  if (cycle === 'weekly') return new Date(d.getTime() + 7 * 24 * 60 * 60 * 1000);
  const y = d.getUTCFullYear() + (cycle === 'yearly' ? 1 : 0);
  const m = d.getUTCMonth() + (cycle === 'monthly' ? 1 : 0);
  const dim = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m, Math.min(billingDay, dim)));
}

// 지난 결제일을 오늘 이후(오늘 포함) 첫 결제일로 넘긴다 — 이미 오늘 이후면 그대로
export function rollForward(d: Date, cycle: SubscriptionCycle, billingDay: number, today: Date): Date {
  return pastBillingDates(d, cycle, billingDay, today).next;
}

// 오늘 전에 지나간 결제일 목록과, 그 뒤 오늘 이후 첫 결제일
export function pastBillingDates(d: Date, cycle: SubscriptionCycle, billingDay: number, today: Date): { past: Date[]; next: Date } {
  const past: Date[] = [];
  let next = d;
  while (next < today) {
    past.push(next);
    next = addCycle(next, cycle, billingDay);
  }
  return { past, next };
}
