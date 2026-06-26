import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { InvestmentService } from './investment.service';
import { PriceLookupService } from './price-lookup.service';

// 투자 종목 — 반복매수(주식모으기) 회차 적립, 매수/매도 시 계좌 예수금 연동, 반복매수 필수값 검증 회귀 테스트.
// PriceLookupService 는 외부 API 호출이므로 모킹, Prisma 는 인메모리 가짜.
describe('InvestmentService', () => {
  let rows: any[];
  let accounts: any[];
  let seq: number;
  let prisma: any;
  let priceLookup: { lookup: jest.Mock };

  const svc = () => new InvestmentService(prisma, priceLookup as unknown as PriceLookupService);
  const dec = (n: number) => new Prisma.Decimal(n);

  beforeEach(() => {
    rows = [];
    accounts = [{ id: 1, user_id: 1, deleted_at: null, cash_balance: dec(1_000_000) }];
    seq = 1;
    priceLookup = { lookup: jest.fn(async () => ({ price: 1000, currency: 'KRW', krwPrice: 1000, name: '테스트종목' })) };

    prisma = {
      investment: {
        findMany: jest.fn(async ({ where }: any) =>
          rows.filter(
            (r) =>
              r.user_id === where.user_id &&
              r.deleted_at == null &&
              (where.recurring_buy_enabled === undefined || r.recurring_buy_enabled === where.recurring_buy_enabled),
          ),
        ),
        findFirst: jest.fn(async ({ where }: any) =>
          rows.find((r) => r.id === where.id && r.user_id === where.user_id && r.deleted_at == null) ?? null,
        ),
        create: jest.fn(async ({ data }: any) => {
          const row = { id: seq++, deleted_at: null, updated_at: new Date(), ...data };
          rows.push(row);
          return row;
        }),
        update: jest.fn(async ({ where, data }: any) => {
          const row = rows.find((r) => r.id === where.id);
          applyData(row, data);
          row.updated_at = new Date();
          return row;
        }),
        updateMany: jest.fn(async ({ where, data }: any) => {
          const matched = rows.filter((r) => where.id.in.includes(r.id) && r.user_id === where.user_id && r.deleted_at == null);
          for (const row of matched) applyData(row, data);
          return { count: matched.length };
        }),
        count: jest.fn(async () => rows.length),
      },
      investmentAccount: {
        findFirst: jest.fn(async ({ where }: any) =>
          accounts.find((a) => a.id === where.id && a.user_id === where.user_id && a.deleted_at == null) ?? null,
        ),
        update: jest.fn(async ({ where, data }: any) => {
          const row = accounts.find((a) => a.id === where.id);
          applyData(row, data);
          return row;
        }),
      },
      $transaction: jest.fn(async (arg: any) => (Array.isArray(arg) ? Promise.all(arg) : arg(prisma))),
    };
  });

  // Prisma update data 흉내 — {increment}/{decrement} 연산자 + undefined 무시
  function applyData(row: any, data: Record<string, any>) {
    for (const [k, v] of Object.entries(data)) {
      if (v === undefined) continue;
      if (v && typeof v === 'object' && ('increment' in v || 'decrement' in v)) {
        const delta = 'increment' in v ? v.increment : v.decrement;
        const deltaDec = delta instanceof Prisma.Decimal ? delta : new Prisma.Decimal(delta);
        row[k] = 'increment' in v ? row[k].add(deltaDec) : row[k].sub(deltaDec);
      } else {
        row[k] = v;
      }
    }
  }

  describe('create', () => {
    it('소속 계좌가 없으면 BadRequest', async () => {
      await expect(
        svc().create(1, { accountId: 999, name: 'A', type: 'domestic_stock', principal: 1000, currentValue: 1000 } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('반복매수 활성화 시 필수값(종목코드/금액/규칙/매수일) 누락이면 BadRequest', async () => {
      await expect(
        svc().create(1, {
          accountId: 1, name: 'A', type: 'domestic_stock', principal: 0, currentValue: 0,
          recurringBuyEnabled: true,
        } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('반복매수 필수값이 모두 있으면 quantity 0으로 생성', async () => {
      const res = await svc().create(1, {
        accountId: 1, name: 'A', type: 'domestic_stock', symbol: '005930', principal: 0, currentValue: 0,
        purchaseDate: '2026-01-15', recurringBuyEnabled: true, recurringBuyAmount: 10000,
        recurringBuyRule: { cycle: 'monthly', day: 15 },
      } as any);
      expect(res.quantity).toBe(0);
      expect(res.recurringBuyEnabled).toBe(true);
    });
  });

  describe('update', () => {
    it('타인 소유 종목은 NotFound', async () => {
      rows.push({ id: 1, user_id: 2, account_id: 1, deleted_at: null, principal: dec(0), current_value: dec(0), quantity: null });
      await expect(svc().update(1, 1, { name: 'X' } as any)).rejects.toThrow(NotFoundException);
    });

    it('다른 계좌로 변경 시 그 계좌도 본인 소유여야 함', async () => {
      rows.push({ id: 1, user_id: 1, account_id: 1, deleted_at: null, principal: dec(0), current_value: dec(0), quantity: null });
      await expect(svc().update(1, 1, { accountId: 999 } as any)).rejects.toThrow(BadRequestException);
    });
  });

  describe('buy/sell', () => {
    function seedInvestment(over: Partial<any> = {}) {
      const row = {
        id: seq++, user_id: 1, account_id: 1, deleted_at: null,
        type: 'domestic_stock', symbol: '005930', name: '삼성전자',
        quantity: dec(10), principal: dec(100_000), current_value: dec(100_000),
        recurring_buy_enabled: false, recurring_buy_rule: null, recurring_buy_amount: null,
        purchase_date: null, memo: null, updated_at: new Date(),
        ...over,
      };
      rows.push(row);
      return row;
    }

    it('매수: 시세조회 단가로 예수금 차감 + 보유수량/원금/평가금액 증가', async () => {
      const inv = seedInvestment();
      const res = await svc().buy(1, inv.id, { quantity: 5 } as any);
      expect(priceLookup.lookup).toHaveBeenCalledWith('domestic_stock', '005930');
      expect(accounts[0].cash_balance.toNumber()).toBe(1_000_000 - 5 * 1000);
      expect(res.quantity).toBe(15);
      expect(res.principal).toBe(105_000);
      expect(res.currentValue).toBe(105_000);
    });

    it('매수: 단가 직접 입력 시 시세조회 안 함', async () => {
      const inv = seedInvestment();
      await svc().buy(1, inv.id, { quantity: 2, price: 500 } as any);
      expect(priceLookup.lookup).not.toHaveBeenCalled();
      expect(accounts[0].cash_balance.toNumber()).toBe(1_000_000 - 1000);
    });

    it('매수: 예수금 부족이면 BadRequest, 상태 변경 없음', async () => {
      const inv = seedInvestment();
      accounts[0].cash_balance = dec(100);
      await expect(svc().buy(1, inv.id, { quantity: 5 } as any)).rejects.toThrow(BadRequestException);
      expect(inv.quantity.toNumber()).toBe(10);
      expect(accounts[0].cash_balance.toNumber()).toBe(100);
    });

    it('매수: 종목코드 없는데 단가 미입력이면 BadRequest', async () => {
      const inv = seedInvestment({ symbol: null });
      await expect(svc().buy(1, inv.id, { quantity: 1 } as any)).rejects.toThrow(BadRequestException);
    });

    it('매도: 보유수량 부족이면 BadRequest', async () => {
      const inv = seedInvestment({ quantity: dec(1) });
      await expect(svc().sell(1, inv.id, { quantity: 5 } as any)).rejects.toThrow(BadRequestException);
    });

    it('매도: 매도수량만큼 보유수량 차감 + 평가금액 차감 + 예수금 환입', async () => {
      const inv = seedInvestment();
      const res = await svc().sell(1, inv.id, { quantity: 4, price: 1000 } as any);
      expect(res.quantity).toBe(6);
      expect(res.currentValue).toBe(100_000 - 4000);
      expect(res.principal).toBe(100_000); // 원금은 누적 투입 기준 유지
      expect(accounts[0].cash_balance.toNumber()).toBe(1_000_000 + 4000);
    });

    it('매도: 매도금액이 평가금액을 초과해도 평가금액은 0 미만으로 내려가지 않음', async () => {
      const inv = seedInvestment({ current_value: dec(1000) });
      const res = await svc().sell(1, inv.id, { quantity: 10, price: 1000 } as any);
      expect(res.currentValue).toBe(0);
    });
  });

  describe('lookupPrice/quote', () => {
    it('lookupPrice: 종목코드 없으면 BadRequest', async () => {
      rows.push({ id: 1, user_id: 1, deleted_at: null, symbol: null, quantity: null });
      await expect(svc().lookupPrice(1, 1)).rejects.toThrow(BadRequestException);
    });

    it('lookupPrice: 보유수량 없으면 BadRequest', async () => {
      rows.push({ id: 1, user_id: 1, deleted_at: null, symbol: '005930', quantity: null, type: 'domestic_stock' });
      await expect(svc().lookupPrice(1, 1)).rejects.toThrow(BadRequestException);
    });

    it('lookupPrice: 단가×보유수량 = 평가금액', async () => {
      rows.push({ id: 1, user_id: 1, deleted_at: null, symbol: '005930', quantity: new Prisma.Decimal(3), type: 'domestic_stock' });
      const res = await svc().lookupPrice(1, 1);
      expect(res.evaluatedValue).toBe(3000);
    });
  });

  describe('materializeRecurringBuys (findAll/summary 호출 시 자동 적립)', () => {
    function seedRecurring(over: Partial<any> = {}) {
      const row = {
        id: seq++, user_id: 1, account_id: 1, deleted_at: null,
        type: 'domestic_stock', symbol: '005930', name: '삼성전자',
        quantity: dec(0), principal: dec(0), current_value: dec(0),
        recurring_buy_enabled: true,
        recurring_buy_rule: { cycle: 'monthly', day: 15 },
        recurring_buy_amount: dec(10000),
        recurring_buy_last_period: null,
        purchase_date: new Date('2026-01-15T00:00:00Z'),
        memo: null, updated_at: new Date(),
        ...over,
      };
      rows.push(row);
      return row;
    }

    it('미처리 회차를 시세로 매수해 예수금 차감 + 수량/원금 누적', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-03-20T00:00:00Z'));
      seedRecurring();
      await svc().findAll(1);
      // 최초 매수일(1/15) 자체는 회차로 안 치고, 2/15·3/15 두 회차만 누적. 회차당 10000원/1000원=10개
      expect(rows[0].principal.toNumber()).toBe(20000);
      expect(rows[0].quantity.toNumber()).toBe(20);
      expect(accounts[0].cash_balance.toNumber()).toBe(1_000_000 - 20000);
      jest.useRealTimers();
    });

    it('예수금이 부족하면 그 회차에서 멈추고 이전 회차까지만 반영', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-03-20T00:00:00Z'));
      accounts[0].cash_balance = dec(15000); // 1회차(10000)만 가능, 2회차부터 부족
      seedRecurring();
      await svc().findAll(1);
      expect(rows[0].principal.toNumber()).toBe(10000);
      expect(accounts[0].cash_balance.toNumber()).toBe(5000);
      jest.useRealTimers();
    });

    it('이미 처리한 회차는 재적립하지 않음(idempotent)', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-03-20T00:00:00Z'));
      seedRecurring();
      await svc().findAll(1);
      const principalAfterFirst = rows[0].principal.toNumber();
      await svc().findAll(1);
      expect(rows[0].principal.toNumber()).toBe(principalAfterFirst);
      jest.useRealTimers();
    });

    it('symbol/규칙/금액 중 하나라도 없으면 건드리지 않음', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-03-20T00:00:00Z'));
      seedRecurring({ symbol: null });
      await svc().findAll(1);
      expect(rows[0].principal.toNumber()).toBe(0);
      jest.useRealTimers();
    });
  });
});
