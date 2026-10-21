import { Prisma } from '@prisma/client';
import { SubscriptionCronService } from './subscription-cron.service';
import { PriceLookupService } from '../investment/price-lookup.service';

// 구독 결제일 넘기기 + 가계부 자동 등록 — 지나간 결제일마다 지출 내역, 지운 내역은 다시 만들지 않음, USD 환산
describe('SubscriptionCronService.rollForwardPastDue', () => {
  let subs: any[];
  let txs: any[];
  let prisma: any;
  let priceLookup: { getExchangeRate: jest.Mock };
  const svc = () => new SubscriptionCronService(prisma, priceLookup as unknown as PriceLookupService);
  const d = (s: string) => new Date(`${s}T00:00:00Z`);

  function sub(over: Record<string, any> = {}) {
    const { amount, ...rest } = over;
    subs.push({
      id: subs.length + 1, user_id: 1, name: '유튜브 프리미엄', currency: 'KRW', pay_method: 'shinhan_card',
      auto_ledger: true, cycle: 'monthly', status: 'active', next_payment_date: d('2026-10-21'), billing_day: 21,
      created_at: new Date('2026-01-01T00:00:00Z'), deleted_at: null,
      ...rest,
      amount: new Prisma.Decimal(amount ?? 14900),
    });
  }

  beforeEach(() => {
    // KST 2026-10-22 00:05
    jest.useFakeTimers().setSystemTime(new Date('2026-10-21T15:05:00Z'));
    subs = [];
    txs = [];
    priceLookup = { getExchangeRate: jest.fn(async () => 1385.5) };
    prisma = {
      subscription: {
        findMany: jest.fn(async ({ where }: any) =>
          subs.filter((s) => s.deleted_at == null && s.status !== 'paused' && s.next_payment_date < where.next_payment_date.lt)),
        update: jest.fn(async ({ where, data }: any) => Object.assign(subs.find((s) => s.id === where.id), data)),
      },
      transaction: {
        findMany: jest.fn(async ({ where }: any) =>
          txs.filter((t) => t.subscription_id === where.subscription_id && where.date.in.some((x: Date) => x.getTime() === t.date.getTime()))),
        createMany: jest.fn(async ({ data }: any) => { txs.push(...data); return { count: data.length }; }),
      },
      $transaction: jest.fn(async (fn: any) => fn(prisma)),
    };
  });
  afterEach(() => jest.useRealTimers());

  it('결제일이 지난 구독은 그 결제일 날짜로 지출 내역을 만들고 다음 결제일로 넘긴다', async () => {
    sub();
    const res = await svc().rollForwardPastDue();

    expect(txs).toEqual([expect.objectContaining({
      user_id: 1, type: 'expense', date: d('2026-10-21'), title: '유튜브 프리미엄', category: 'insurance_subscription',
      pay_method: 'shinhan_card', memo: null, subscription_id: 1,
    })]);
    expect(txs[0].amount.toNumber()).toBe(14900);
    expect(subs[0].next_payment_date).toEqual(d('2026-11-21'));
    expect(res).toBe('구독 결제일 1건 갱신 · 가계부 1건 추가');
  });

  it('자동 등록을 끈 구독은 결제일만 넘긴다', async () => {
    sub({ auto_ledger: false });
    await svc().rollForwardPastDue();
    expect(txs).toHaveLength(0);
    expect(subs[0].next_payment_date).toEqual(d('2026-11-21'));
  });

  it('이미 만든 결제일(지운 내역 포함)은 다시 만들지 않는다', async () => {
    sub();
    txs.push({ subscription_id: 1, date: d('2026-10-21'), deleted_at: new Date() });
    await svc().rollForwardPastDue();
    expect(prisma.transaction.createMany).not.toHaveBeenCalled();
    expect(subs[0].next_payment_date).toEqual(d('2026-11-21'));
  });

  it('구독을 등록하기 전 결제일은 만들지 않는다', async () => {
    // 10-22 에 등록하면서 지난 결제일(10-21)을 넣은 경우
    sub({ created_at: new Date('2026-10-21T15:01:00Z') });
    await svc().rollForwardPastDue();
    expect(txs).toHaveLength(0);
    expect(subs[0].next_payment_date).toEqual(d('2026-11-21'));
  });

  it('USD 구독은 그날 환율로 원화 환산하고 원래 금액 · 환율을 메모에 남긴다', async () => {
    sub({ name: 'ChatGPT', currency: 'USD', amount: 20 });
    await svc().rollForwardPastDue();
    expect(priceLookup.getExchangeRate).toHaveBeenCalledWith('USD', 'KRW');
    expect(txs[0].amount.toNumber()).toBe(27710);
    expect(txs[0].memo).toBe('USD 20 × 1,385.5원');
  });

  it('환율 조회에 실패하면 USD 구독은 결제일도 그대로 두고, 나머지를 처리한 뒤 실패로 마감한다', async () => {
    priceLookup.getExchangeRate.mockRejectedValue(new Error('timeout'));
    sub();
    sub({ name: 'ChatGPT', currency: 'USD', amount: 20 });

    await expect(svc().rollForwardPastDue()).rejects.toThrow('USD 구독 1건은 내일 다시');
    expect(txs).toHaveLength(1);
    expect(subs[0].next_payment_date).toEqual(d('2026-11-21'));
    expect(subs[1].next_payment_date).toEqual(d('2026-10-21'));
  });

  it('KRW 구독만 있으면 환율을 조회하지 않는다', async () => {
    sub();
    await svc().rollForwardPastDue();
    expect(priceLookup.getExchangeRate).not.toHaveBeenCalled();
  });
});
