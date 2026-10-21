import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TransactionService } from './transaction.service';

// 거래 내역 — 자산이동(transfer)의 대상 잔액 자동 반영/역반영,
// 수정 시 차액 재반영, 삭제 시 역반영 회귀 테스트.
describe('TransactionService (자산이동 연동)', () => {
  let txs: any[];
  let savings: any[];
  let investmentAccounts: any[];
  let seq: number;
  let prisma: any;

  const sysLog = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
  const svc = () => new TransactionService(prisma, sysLog as any);
  const dec = (n: number) => new Prisma.Decimal(n);

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

  beforeEach(() => {
    txs = [];
    savings = [{ id: 1, user_id: 1, deleted_at: null, balance: dec(10000) }];
    investmentAccounts = [{ id: 1, user_id: 1, deleted_at: null, cash_balance: dec(10000) }];
    seq = 1;

    prisma = {
      transaction: {
        findFirst: jest.fn(async ({ where }: any) =>
          txs.find((t) => t.id === where.id && t.user_id === where.user_id && t.deleted_at == null) ?? null,
        ),
        findMany: jest.fn(async ({ where }: any) => {
          if (where?.id?.in) {
            return txs.filter((t) => where.id.in.includes(t.id) && t.user_id === where.user_id && t.deleted_at == null);
          }
          return txs.filter((t) => t.user_id === where.user_id && t.deleted_at == null);
        }),
        create: jest.fn(async ({ data }: any) => {
          const row = { id: seq++, deleted_at: null, ...data };
          txs.push(row);
          return row;
        }),
        update: jest.fn(async ({ where, data }: any) => {
          const row = txs.find((t) => t.id === where.id);
          applyData(row, data);
          return row;
        }),
        updateMany: jest.fn(async ({ where, data }: any) => {
          const matched = txs.filter((t) => where.id.in.includes(t.id) && t.user_id === where.user_id);
          for (const row of matched) applyData(row, data);
          return { count: matched.length };
        }),
      },
      saving: {
        updateMany: jest.fn(async ({ where, data }: any) => {
          const matched = savings.filter((s) => s.id === where.id && s.user_id === where.user_id && s.deleted_at == null);
          for (const row of matched) applyData(row, data);
          return { count: matched.length };
        }),
      },
      investmentAccount: {
        updateMany: jest.fn(async ({ where, data }: any) => {
          const matched = investmentAccounts.filter((a) => a.id === where.id && a.user_id === where.user_id && a.deleted_at == null);
          for (const row of matched) applyData(row, data);
          return { count: matched.length };
        }),
      },
      category: { findMany: jest.fn(async () => []) },
      $transaction: jest.fn(async (arg: any) => (Array.isArray(arg) ? Promise.all(arg) : arg(prisma))),
    };
  });

  const baseDto = (over: Record<string, any> = {}) => ({
    type: 'transfer', date: '2026-06-01', title: '이동', category: 'transfer', amount: 5000, ...over,
  });

  describe('create', () => {
    it('saving 대상이면 잔액 증가', async () => {
      await svc().create(1, baseDto({ targetType: 'saving', targetId: 1 }) as any);
      expect(savings[0].balance.toNumber()).toBe(15000);
    });

    it('investment 대상이면 계좌 예수금 증가', async () => {
      await svc().create(1, baseDto({ targetType: 'investment', targetId: 1 }) as any);
      expect(investmentAccounts[0].cash_balance.toNumber()).toBe(15000);
    });

    it('존재하지 않는 이동 대상이면 BadRequest (필수 반영)', async () => {
      await expect(svc().create(1, baseDto({ targetType: 'saving', targetId: 999 }) as any)).rejects.toThrow(BadRequestException);
    });

    it('transfer 타입이 아니면 target 무시', async () => {
      await svc().create(1, baseDto({ type: 'expense', category: 'food', targetType: 'saving', targetId: 1 }) as any);
      expect(savings[0].balance.toNumber()).toBe(10000);
    });
  });

  describe('update', () => {
    it('금액 변경 시 기존 효과 역반영 후 새 금액으로 재반영', async () => {
      const created = await svc().create(1, baseDto({ targetType: 'saving', targetId: 1 }) as any);
      expect(savings[0].balance.toNumber()).toBe(15000);
      await svc().update(1, created.id, { amount: 8000 } as any);
      expect(savings[0].balance.toNumber()).toBe(18000); // 10000 - 5000(역반영) + 8000
    });

    it('대상을 다른 곳으로 변경하면 이전 대상은 역반영, 새 대상에 반영', async () => {
      const created = await svc().create(1, baseDto({ targetType: 'saving', targetId: 1 }) as any);
      await svc().update(1, created.id, { targetType: 'investment', targetId: 1 } as any);
      expect(savings[0].balance.toNumber()).toBe(10000);
      expect(investmentAccounts[0].cash_balance.toNumber()).toBe(15000);
    });

    it('타인 소유 내역은 NotFound', async () => {
      const created = await svc().create(1, baseDto() as any);
      await expect(svc().update(2, created.id, { amount: 1 } as any)).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('연동된 거래 삭제 시 대상 잔액 역반영', async () => {
      const created = await svc().create(1, baseDto({ targetType: 'saving', targetId: 1 }) as any);
      await svc().remove(1, created.id);
      expect(savings[0].balance.toNumber()).toBe(10000);
      expect(txs[0].deleted_at).toBeInstanceOf(Date);
    });

    it('대상이 이미 삭제됐어도 거래 삭제는 허용(조용히 건너뜀)', async () => {
      const created = await svc().create(1, baseDto({ targetType: 'saving', targetId: 1 }) as any);
      savings.length = 0;
      await expect(svc().remove(1, created.id)).resolves.toEqual({ id: created.id });
    });
  });

  describe('removeMany', () => {
    it('ids 비어있으면 BadRequest', async () => {
      await expect(svc().removeMany(1, [])).rejects.toThrow(BadRequestException);
    });

    it('각 행의 대상별로 역반영 후 일괄 삭제', async () => {
      const a = await svc().create(1, baseDto({ targetType: 'saving', targetId: 1 }) as any);
      const b = await svc().create(1, baseDto({ targetType: 'investment', targetId: 1 }) as any);
      const res = await svc().removeMany(1, [a.id, b.id]);
      expect(res.count).toBe(2);
      expect(savings[0].balance.toNumber()).toBe(10000);
      expect(investmentAccounts[0].cash_balance.toNumber()).toBe(10000);
    });

    it('같은 대상 행은 금액을 합쳐 한 번만 역반영하고, 삭제 표시도 한 번에', async () => {
      const a = await svc().create(1, baseDto({ targetType: 'saving', targetId: 1, amount: 1000 }) as any);
      const b = await svc().create(1, baseDto({ targetType: 'saving', targetId: 1, amount: 2000 }) as any);
      const c = await svc().create(1, baseDto({ type: 'expense', category: 'food', amount: 3000 }) as any);
      prisma.saving.updateMany.mockClear();

      const res = await svc().removeMany(1, [a.id, b.id, c.id]);

      expect(res.count).toBe(3);
      expect(prisma.saving.updateMany).toHaveBeenCalledTimes(1);
      expect(savings[0].balance.toNumber()).toBe(10000);
      expect(prisma.transaction.update).not.toHaveBeenCalled();
      expect(prisma.transaction.updateMany).toHaveBeenCalledTimes(1);
      expect(txs.every((t) => t.deleted_at)).toBe(true);
    });
  });

  describe('materializeRecurring', () => {
    const schedule = (id: number) => ({
      id, user_id: 1, deleted_at: null, kind: 'transaction', active: true,
      rule: { cycle: 'monthly', day: 15 }, start_date: new Date('2026-01-15T00:00:00Z'),
      tx_type: 'expense', title: `설정${id}`, category: 'food', amount: dec(1000), pay_method: 'cash', memo: null,
      target_type: null, target_id: null,
    });

    it('이미 만든 회차는 설정마다가 아니라 한 번에 조회하고, 빠진 회차만 만든다', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-03-20T00:00:00Z'));
      prisma.recurringSchedule = {
        findMany: jest.fn(async () => [schedule(1), schedule(2)]),
        update: jest.fn(async () => ({})),
      };
      prisma.transaction.createMany = jest.fn(async () => ({ count: 0 }));
      // 설정 1 은 1월 회차를 이미 만들었다(삭제분 포함)
      prisma.transaction.findMany = jest.fn(async () => [
        { recurring_schedule_id: 1, recurring_period: '2026-01' },
      ]);

      await svc().materializeRecurring(1);

      expect(prisma.transaction.findMany).toHaveBeenCalledTimes(1);
      expect(prisma.transaction.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: { user_id: 1, recurring_schedule_id: { in: [1, 2] } },
      }));
      const created = prisma.transaction.createMany.mock.calls.map((c: any) => c[0].data.map((d: any) => `${d.recurring_schedule_id}:${d.recurring_period}`));
      expect(created).toEqual([
        ['1:2026-02', '1:2026-03'],
        ['2:2026-01', '2:2026-02', '2:2026-03'],
      ]);
      jest.useRealTimers();
    });
  });
});
