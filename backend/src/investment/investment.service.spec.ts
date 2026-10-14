import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { InvestmentService } from './investment.service';
import { PriceLookupService } from './price-lookup.service';

// 투자 종목 — 매수/매도 시 계좌 예수금 연동, 자동이체 설정(RecurringSchedule) 기반 반복매수 회차 적립 회귀 테스트.
// PriceLookupService 는 외부 API 호출이므로 모킹, Prisma 는 인메모리 가짜.
describe('InvestmentService', () => {
  let rows: any[];
  let accounts: any[];
  let schedules: any[];
  let seq: number;
  let scheduleSeq: number;
  let prisma: any;
  let priceLookup: { lookup: jest.Mock };

  const sysLog = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
  const svc = () => new InvestmentService(prisma, priceLookup as unknown as PriceLookupService, sysLog as any);
  const dec = (n: number) => new Prisma.Decimal(n);

  beforeEach(() => {
    rows = [];
    accounts = [{ id: 1, user_id: 1, deleted_at: null, cash_balance: dec(1_000_000) }];
    schedules = [];
    seq = 1;
    scheduleSeq = 1;
    priceLookup = { lookup: jest.fn(async () => ({ price: 1000, currency: 'KRW', krwPrice: 1000, name: '테스트종목' })) };

    prisma = {
      investment: {
        findMany: jest.fn(async ({ where }: any) => rows.filter((r) => r.user_id === where.user_id && r.deleted_at == null)),
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
      recurringSchedule: {
        findMany: jest.fn(async ({ where }: any) => {
          const typeFilter = where.investment?.type;
          return schedules
            .filter((s) => s.user_id === where.user_id && s.deleted_at == null && s.kind === where.kind && s.active === where.active)
            .map((s) => ({ ...s, investment: rows.find((r) => r.id === s.investment_id) ?? null }))
            .filter((s) => s.investment && s.investment.deleted_at == null)
            .filter((s) => {
              if (!typeFilter) return true;
              if (typeFilter.in) return typeFilter.in.includes(s.investment.type);
              if (typeFilter.notIn) return !typeFilter.notIn.includes(s.investment.type);
              return true;
            });
        }),
        update: jest.fn(async ({ where, data }: any) => {
          const row = schedules.find((s) => s.id === where.id);
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

    it('정상 입력이면 순수 데이터만 생성 (자동이체 설정은 별도)', async () => {
      const res = await svc().create(1, {
        accountId: 1, name: 'A', type: 'domestic_stock', symbol: '005930', quantity: 10, principal: 1_000_000, currentValue: 1_000_000,
      } as any);
      expect(res.quantity).toBe(10);
      expect(res.principal).toBe(1_000_000);
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
      expect(res.principal).toBe(60_000); // 평균단가 기준 — 10주 중 4주를 팔면 원금도 4/10 줄어든다
      expect(accounts[0].cash_balance.toNumber()).toBe(1_000_000 + 4000);
    });

    it('매도: 이익을 보고 팔면 남은 수익도 이익으로 남는다 (원금을 그대로 두면 손실로 보이던 문제)', async () => {
      // 12주 · 원금 120,000(평균 10,000) · 평가 130,000 → 1주를 12,000 에 매도
      const inv = seedInvestment({ quantity: dec(12), principal: dec(120_000), current_value: dec(130_000) });
      const res = await svc().sell(1, inv.id, { quantity: 1, price: 12_000 } as any);
      expect(res.principal).toBe(110_000);
      expect(res.currentValue).toBe(118_000);
      expect(res.currentValue - res.principal).toBeGreaterThan(0);
    });

    it('매도: 전량 매도하면 원금도 0', async () => {
      const inv = seedInvestment();
      const res = await svc().sell(1, inv.id, { quantity: 10, price: 1000 } as any);
      expect(res.principal).toBe(0);
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

  describe('materializeRecurringBuys (RecurringCronService가 매일 오전 9시 호출)', () => {
    function seedInvestment(over: Partial<any> = {}) {
      const row = {
        id: seq++, user_id: 1, account_id: 1, deleted_at: null,
        type: 'domestic_stock', symbol: '005930', name: '삼성전자',
        quantity: dec(0), principal: dec(0), current_value: dec(0),
        purchase_date: null, memo: null, updated_at: new Date(),
        ...over,
      };
      rows.push(row);
      return row;
    }

    function seedSchedule(investmentId: number, over: Partial<any> = {}) {
      const row = {
        id: scheduleSeq++, user_id: 1, deleted_at: null, kind: 'investment', active: true,
        investment_id: investmentId,
        rule: { cycle: 'monthly', day: 15 },
        buy_amount: dec(10000),
        buy_quantity: null,
        last_period: null,
        start_date: new Date('2026-01-15T00:00:00Z'),
        ...over,
      };
      schedules.push(row);
      return row;
    }

    // 종목 + 자동이체 설정을 함께 만드는 헬퍼 — 기존 반복매수 테스트의 seedRecurring과 동등
    function seedRecurring(over: Partial<any> = {}) {
      const { scheduleOverride, ...invOver } = over as any;
      const inv = seedInvestment(invOver);
      seedSchedule(inv.id, scheduleOverride);
      return inv;
    }

    it('미처리 회차를 시세로 매수해 예수금 차감 + 수량/원금 누적', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-03-20T00:00:00Z'));
      seedRecurring();
      await svc().materializeRecurringBuys(1);
      // 시작일(1/15) 자체도 첫 회차로 매수 — 1/15·2/15·3/15 세 회차 누적. 회차당 10000원/1000원=10개
      expect(rows[0].principal.toNumber()).toBe(30000);
      expect(rows[0].quantity.toNumber()).toBe(30);
      expect(accounts[0].cash_balance.toNumber()).toBe(1_000_000 - 30000);
      jest.useRealTimers();
    });

    it('예수금이 부족하면 그 회차에서 멈추고 이전 회차까지만 반영', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-03-20T00:00:00Z'));
      accounts[0].cash_balance = dec(15000); // 1회차(10000)만 가능, 2회차부터 부족
      seedRecurring();
      await svc().materializeRecurringBuys(1);
      expect(rows[0].principal.toNumber()).toBe(10000);
      expect(accounts[0].cash_balance.toNumber()).toBe(5000);
      jest.useRealTimers();
    });

    it('이미 처리한 회차는 재적립하지 않음(idempotent)', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-03-20T00:00:00Z'));
      seedRecurring();
      await svc().materializeRecurringBuys(1);
      const principalAfterFirst = rows[0].principal.toNumber();
      await svc().materializeRecurringBuys(1);
      expect(rows[0].principal.toNumber()).toBe(principalAfterFirst);
      jest.useRealTimers();
    });

    it('symbol/규칙/금액 중 하나라도 없으면 건드리지 않음', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-03-20T00:00:00Z'));
      seedRecurring({ symbol: null });
      await svc().materializeRecurringBuys(1);
      expect(rows[0].principal.toNumber()).toBe(0);
      jest.useRealTimers();
    });

    it('weekly: 설정일 이후 첫 번째 해당 요일 회차를 매수함', async () => {
      // 화요일(6/30)에 설정, 매주 월요일 → 다음 월요일(7/6)이 첫 회차
      jest.useFakeTimers().setSystemTime(new Date('2026-07-06T09:00:00Z'));
      seedRecurring({
        scheduleOverride: {
          rule: { cycle: 'weekly', day: 1 }, // 월요일
          start_date: new Date('2026-06-30T00:00:00Z'),
          last_period: '2026-06-30', // 설정 시점으로 초기화
        },
      });
      await svc().materializeRecurringBuys(1);
      expect(rows[0].principal.toNumber()).toBe(10000);
      expect(accounts[0].cash_balance.toNumber()).toBe(1_000_000 - 10000);
      jest.useRealTimers();
    });

    it('daily: start_date가 설정일보다 미래이면 해당 날짜 크론에서 매수함', async () => {
      // 6/28에 설정, start_date=6/29, 6/29 23:00 크론 실행 → 첫 회차 매수
      jest.useFakeTimers().setSystemTime(new Date('2026-06-29T23:00:00Z'));
      seedRecurring({
        scheduleOverride: {
          rule: { cycle: 'daily', day: 0 },
          start_date: new Date('2026-06-29T00:00:00Z'),
          last_period: '2026-06-28', // 설정일(전날)로 초기화
        },
      });
      await svc().materializeRecurringBuys(1);
      expect(rows[0].principal.toNumber()).toBe(10000);
      expect(accounts[0].cash_balance.toNumber()).toBe(1_000_000 - 10000);
      jest.useRealTimers();
    });

    it('종목이 배치 크기(3)를 넘으면 묶음 사이에 대기하며, 모든 종목이 처리됨', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-02-15T00:00:00Z'));
      const sleepSpy = jest.spyOn(global, 'setTimeout').mockImplementation((fn: any) => { fn(); return 0 as any; });
      accounts[0].cash_balance = dec(1_000_000);
      seedRecurring({ symbol: 'A' });
      seedRecurring({ symbol: 'B' });
      seedRecurring({ symbol: 'C' });
      seedRecurring({ symbol: 'D' }); // 4개 — 3개씩 묶으면 2묶음, 묶음 사이 대기 1회 발생
      await svc().materializeRecurringBuys(1);
      expect(sleepSpy).toHaveBeenCalledTimes(1);
      expect(sleepSpy).toHaveBeenCalledWith(expect.any(Function), 3000);
      // 시작일(1/15) 회차도 포함되어 1/15·2/15 두 회차 누적
      expect(rows.every((r) => r.principal.toNumber() === 20000)).toBe(true);
      sleepSpy.mockRestore();
      jest.useRealTimers();
    });
  });
});
