import { SubscriptionService } from './subscription.service';
import { PriceLookupService } from '../investment/price-lookup.service';
import { Prisma } from '@prisma/client';

// summary() 의 환율 환산 로직 검증. Prisma 는 인메모리 가짜, PriceLookupService 는 모킹.
describe('SubscriptionService.summary', () => {
  let rows: any[];
  let prisma: any;
  let priceLookup: PriceLookupService;
  const svc = () => new SubscriptionService(prisma, priceLookup);

  beforeEach(() => {
    rows = [];
    prisma = {
      subscription: {
        findMany: jest.fn(async ({ where }: any) =>
          rows.filter((r) => r.user_id === where.user_id && r.deleted_at == null),
        ),
      },
    };
    priceLookup = { getExchangeRate: jest.fn(async () => 1400) } as unknown as PriceLookupService;
  });

  function row(overrides: Partial<any>) {
    const { amount, currency, ...rest } = overrides;
    rows.push({
      id: rows.length + 1,
      user_id: 1,
      name: '테스트 구독',
      category: 'ott',
      cycle: 'monthly',
      status: 'active',
      next_payment_date: new Date('2099-01-01'),
      pay_method: '신한카드',
      last_used_at: null,
      memo: null,
      deleted_at: null,
      ...rest,
      amount: new Prisma.Decimal(amount ?? 10000),
      currency: currency ?? 'KRW',
    });
  }

  it('KRW 구독만 있으면 환율 API를 호출하지 않는다', async () => {
    row({ amount: 10000, currency: 'KRW' });
    const res = await svc().summary(1);
    expect(res.monthlyTotal).toBe(10000);
    expect(priceLookup.getExchangeRate).not.toHaveBeenCalled();
  });

  it('USD 구독은 환율을 반영해 원화 합계에 더해진다', async () => {
    row({ amount: 10000, currency: 'KRW' });
    row({ amount: 10, currency: 'USD' }); // 10 * 1400 = 14000
    const res = await svc().summary(1);
    expect(priceLookup.getExchangeRate).toHaveBeenCalledWith('USD', 'KRW');
    expect(res.monthlyTotal).toBe(24000);
    expect(res.yearlyTotal).toBe(24000 * 12);
  });
});

// update() 의 일시정지 해제 — 쉬는 동안 지난 결제일이 가계부에 자동 등록되지 않게 오늘 이후로 넘긴다
describe('SubscriptionService.update (일시정지 해제)', () => {
  let current: any;
  let prisma: any;
  const priceLookup = { getExchangeRate: jest.fn() } as unknown as PriceLookupService;
  const svc = () => new SubscriptionService(prisma, priceLookup);
  const d = (s: string) => new Date(`${s}T00:00:00Z`);

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-10-22T03:00:00Z')); // KST 10-22 12:00
    current = {
      id: 1, user_id: 1, name: '유튜브 프리미엄', category: 'ott', amount: new Prisma.Decimal(14900), currency: 'KRW',
      cycle: 'monthly', status: 'paused', next_payment_date: d('2026-07-21'), billing_day: 21,
      pay_method: 'shinhan_card', auto_ledger: true, last_used_at: null, memo: null, deleted_at: null,
    };
    prisma = {
      subscription: {
        findFirst: jest.fn(async () => current),
        update: jest.fn(async ({ data }: any) => ({ ...current, ...Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined)) })),
      },
    };
  });
  afterEach(() => jest.useRealTimers());

  it('일시정지를 풀면 지난 결제일을 오늘 이후 첫 결제일로 넘긴다', async () => {
    const res = await svc().update(1, 1, { status: 'active', nextPaymentDate: '2026-07-21' });
    expect(res.nextPaymentDate).toBe('2026-11-21');
    expect(prisma.subscription.update.mock.calls[0][0].data.billing_day).toBeUndefined();
  });

  it('일시정지 그대로면 결제일을 건드리지 않는다', async () => {
    const res = await svc().update(1, 1, { name: '유튜브', nextPaymentDate: '2026-07-21' });
    expect(res.nextPaymentDate).toBe('2026-07-21');
  });
});
