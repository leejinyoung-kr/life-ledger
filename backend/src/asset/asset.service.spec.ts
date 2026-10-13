import { Prisma } from '@prisma/client';
import { AssetService } from './asset.service';
import { PriceLookupService } from '../investment/price-lookup.service';
import { SystemLogService } from '../system-log/system-log.service';

// 순자산 요약 · 추이 — 자산이동 이중 계산 방지와 전월 대비 · 이번 달 막대 기준을 검증. Prisma 는 인메모리 가짜.
describe('AssetService', () => {
  let txs: { type: 'income' | 'expense' | 'transfer'; amount: number }[];
  let savings: number[];
  let snaps: { month: string; total_assets: number; cash_total: number | null }[];
  let prisma: any;
  const dec = (n: number) => new Prisma.Decimal(n);
  const svc = () =>
    new AssetService(
      prisma,
      { getExchangeRate: jest.fn(async () => 1300) } as unknown as PriceLookupService,
      { warn: jest.fn() } as unknown as SystemLogService,
    );

  beforeEach(() => {
    txs = [];
    savings = [];
    snaps = [];
    prisma = {
      transaction: {
        groupBy: jest.fn(async () =>
          (['income', 'expense', 'transfer'] as const).map((type) => ({
            type,
            _sum: { amount: dec(txs.filter((t) => t.type === type).reduce((s, t) => s + t.amount, 0)) },
          })),
        ),
      },
      saving: { findMany: jest.fn(async () => savings.map((b) => ({ balance: dec(b), interest_rate: dec(3) }))) },
      investment: { findMany: jest.fn(async () => []) },
      investmentAccount: { findMany: jest.fn(async () => []) },
      netWorthSnapshot: {
        // 요약은 month < 이번 달 중 최신 1건, 추이는 month < 이번 달 내림차순
        findFirst: jest.fn(async () => toRow(snaps[snaps.length - 1])),
        findMany: jest.fn(async () => [...snaps].reverse().map(toRow)),
      },
    };
  });

  const toRow = (s?: (typeof snaps)[number]) =>
    s && { month: s.month, total_assets: dec(s.total_assets), total_debt: dec(0), cash_total: s.cash_total == null ? null : dec(s.cash_total) };

  it('예적금으로 옮긴 돈은 현금에서 빠진다(이중 계산하지 않는다)', async () => {
    txs.push({ type: 'income', amount: 3_000_000 }, { type: 'expense', amount: 1_000_000 }, { type: 'transfer', amount: 500_000 });
    savings.push(500_000); // 자산이동 연동으로 예적금 잔액에 더해진 돈
    const res = await svc().summary(1);
    expect(res.byType.find((b) => b.type === 'cash')?.amount).toBe(1_500_000);
    expect(res.netWorth).toBe(2_000_000); // 수입 - 지출 = 순자산 증가분과 같다
  });

  it('직전 월말 스냅샷이 없으면 전월 대비는 null', async () => {
    const res = await svc().summary(1);
    expect(res.changeAmount).toBeNull();
    expect(res.changeRate).toBeNull();
  });

  it('전월 대비는 직전 월말 스냅샷과 비교한다', async () => {
    txs.push({ type: 'income', amount: 1_100_000 });
    snaps.push({ month: '2000-01', total_assets: 1_000_000, cash_total: null });
    const res = await svc().summary(1);
    expect(res.changeAmount).toBe(100_000);
    expect(res.changeRate).toBe(10);
  });

  it('추이의 마지막 막대는 이번 달 지금 값이다', async () => {
    txs.push({ type: 'income', amount: 2_000_000 });
    snaps.push({ month: '2000-01', total_assets: 1_000_000, cash_total: null });
    const res = await svc().trend(1);
    expect(res).toHaveLength(2);
    expect(res[0]).toMatchObject({ month: '2000-01', netWorth: 1_000_000, current: false });
    expect(res[1]).toMatchObject({ netWorth: 2_000_000, current: true });
  });
});
