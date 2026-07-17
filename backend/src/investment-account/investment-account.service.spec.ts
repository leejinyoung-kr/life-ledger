import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { InvestmentAccountService } from './investment-account.service';
import { CryptoService } from '@leejinyoun/core-security';
import { PriceLookupService } from '../investment/price-lookup.service';
import { ExchangeDirection } from './dto/exchange-investment-account.dto';

// 투자 계좌 — 계좌번호 마스킹/암호화, 보유종목 집계, 보유종목 있으면 삭제 차단 회귀 테스트.
// CryptoService 는 실제 사용(라운드트립 검증), Prisma 는 인메모리 가짜.
describe('InvestmentAccountService', () => {
  const ORIGINAL = process.env.CREDENTIAL_SECRET;
  let crypto: CryptoService;
  beforeAll(() => {
    process.env.CREDENTIAL_SECRET = 'unit-test-secret';
    crypto = new CryptoService({ secret: process.env.CREDENTIAL_SECRET });
  });
  afterAll(() => {
    process.env.CREDENTIAL_SECRET = ORIGINAL;
  });

  let accounts: any[];
  let investments: any[];
  let seq: number;
  let prisma: any;
  const priceLookup = { getExchangeRate: jest.fn(async () => 1300) } as unknown as PriceLookupService;
  const svc = () => new InvestmentAccountService(prisma, crypto, priceLookup);

  beforeEach(() => {
    accounts = [];
    investments = [];
    seq = 1;
    prisma = {
      investmentAccount: {
        findMany: jest.fn(async ({ where }: any) =>
          accounts.filter(
            (a) =>
              a.user_id === where.user_id &&
              a.deleted_at == null &&
              (!where.name || a.name.includes(where.name.contains)),
          ),
        ),
        findFirst: jest.fn(async ({ where }: any) =>
          accounts.find((a) => a.id === where.id && a.user_id === where.user_id && a.deleted_at == null) ?? null,
        ),
        create: jest.fn(async ({ data }: any) => {
          const row = { id: seq++, deleted_at: null, ...data };
          accounts.push(row);
          return row;
        }),
        update: jest.fn(async ({ where, data }: any) => {
          const row = accounts.find((a) => a.id === where.id);
          for (const [k, v] of Object.entries(data)) {
            if (v === undefined) continue;
            (row as any)[k] = v && typeof v === 'object' && 'increment' in v
              ? (row as any)[k].add(v.increment)
              : v;
          }
          return row;
        }),
        count: jest.fn(async ({ where }: any) =>
          accounts.filter((a) => a.user_id === where.user_id && a.deleted_at == null).length,
        ),
      },
      investment: {
        findMany: jest.fn(async ({ where }: any) =>
          investments.filter(
            (i) =>
              i.user_id === where.user_id &&
              where.account_id.in.includes(i.account_id) &&
              i.deleted_at == null,
          ),
        ),
        count: jest.fn(async ({ where }: any) =>
          investments.filter((i) => i.account_id === where.account_id && i.deleted_at == null).length,
        ),
      },
      $transaction: jest.fn(async (arg: any) => (Array.isArray(arg) ? Promise.all(arg) : arg(prisma))),
    };
  });

  it('create: 계좌번호 암호화 저장, cashBalance 미입력 시 0', async () => {
    const res = await svc().create(1, { name: '토스증권', accountNumber: '110-1234567890' } as any);
    expect(res.cashBalance).toBe(0);
    expect(accounts[0].account_number_enc).toMatch(/^v1:/);
    expect(crypto.decrypt(accounts[0].account_number_enc)).toBe('110-1234567890');
  });

  it('findAll: 계좌번호 중간 마스킹(앞3/뒤4 노출)', async () => {
    await svc().create(1, { name: 'A', accountNumber: '110-1234567890' } as any);
    const [res] = (await svc().findAll(1)) as any[];
    expect(res.accountNumber).toBe(`110${'•'.repeat('110-1234567890'.length - 7)}7890`);
  });

  it('findAll: 계좌번호가 짧으면(7자 이하) 마스킹 없이 그대로 노출', async () => {
    await svc().create(1, { name: 'A', accountNumber: '12345' } as any);
    const [res] = (await svc().findAll(1)) as any[];
    expect(res.accountNumber).toBe('12345');
  });

  it('findAll: 보유종목 집계(개수/원금합/평가금합)가 계좌별로 병합됨', async () => {
    const account = await svc().create(1, { name: 'A', accountNumber: '110-1234567890' } as any);
    investments.push(
      { user_id: 1, account_id: account.id, deleted_at: null, principal: new Prisma.Decimal(1000), current_value: new Prisma.Decimal(1200) },
      { user_id: 1, account_id: account.id, deleted_at: null, principal: new Prisma.Decimal(500), current_value: new Prisma.Decimal(400) },
    );
    const [res] = (await svc().findAll(1)) as any[];
    expect(res.holdingsCount).toBe(2);
    expect(res.totalPrincipal).toBe(1500);
    expect(res.totalCurrentValue).toBe(1600);
  });

  it('summary: 총 예수금/계좌 수', async () => {
    await svc().create(1, { name: 'A', accountNumber: '1', cashBalance: 1000 } as any);
    await svc().create(1, { name: 'B', accountNumber: '2', cashBalance: 2000 } as any);
    const res = await svc().summary(1);
    expect(res).toEqual({ totalCash: 3000, accountCount: 2 });
  });

  it('update: 계좌번호 빈 문자열이면 null로 삭제', async () => {
    const account = await svc().create(1, { name: 'A', accountNumber: '110-1234567890' } as any);
    await svc().update(1, account.id, { accountNumber: '' } as any);
    expect(accounts[0].account_number_enc).toBeNull();
  });

  it('update: 존재하지 않는 계좌는 NotFound', async () => {
    await expect(svc().update(1, 999, { name: 'X' } as any)).rejects.toThrow(NotFoundException);
  });

  it('remove: 보유 종목이 있으면 차단', async () => {
    const account = await svc().create(1, { name: 'A', accountNumber: '1' } as any);
    investments.push({ user_id: 1, account_id: account.id, deleted_at: null });
    await expect(svc().remove(1, account.id)).rejects.toThrow(BadRequestException);
  });

  it('remove: 보유 종목이 없으면 soft delete', async () => {
    const account = await svc().create(1, { name: 'A', accountNumber: '1' } as any);
    await svc().remove(1, account.id);
    expect(accounts[0].deleted_at).toBeInstanceOf(Date);
  });

  it('remove: 타인 계좌는 NotFound', async () => {
    const account = await svc().create(1, { name: 'A', accountNumber: '1' } as any);
    await expect(svc().remove(2, account.id)).rejects.toThrow(NotFoundException);
  });

  it('exchange: 원화→달러, rate 미입력 시 실시간 환율로 계산', async () => {
    const account = await svc().create(1, { name: 'A', accountNumber: '1', cashBalance: 130_000 } as any);
    const res = await svc().exchange(1, account.id, { direction: ExchangeDirection.KRW_TO_USD, amount: 130_000 } as any);
    expect(priceLookup.getExchangeRate).toHaveBeenCalledWith('USD', 'KRW');
    expect(res.cashBalance).toBe(0);
    expect(res.cashBalanceUsd).toBe(100);
  });

  it('exchange: 달러→원화, rate 직접 입력 시 그 값 사용', async () => {
    const account = await svc().create(1, { name: 'A', accountNumber: '1', cashBalanceUsd: 100 } as any);
    const res = await svc().exchange(1, account.id, { direction: ExchangeDirection.USD_TO_KRW, amount: 100, rate: 1400 } as any);
    expect(res.cashBalanceUsd).toBe(0);
    expect(res.cashBalance).toBe(140_000);
  });

  it('exchange: 원화 부족하면 BadRequest', async () => {
    const account = await svc().create(1, { name: 'A', accountNumber: '1', cashBalance: 1000 } as any);
    await expect(
      svc().exchange(1, account.id, { direction: ExchangeDirection.KRW_TO_USD, amount: 2000 } as any),
    ).rejects.toThrow(BadRequestException);
  });

  it('exchange: 달러 부족하면 BadRequest', async () => {
    const account = await svc().create(1, { name: 'A', accountNumber: '1', cashBalanceUsd: 10 } as any);
    await expect(
      svc().exchange(1, account.id, { direction: ExchangeDirection.USD_TO_KRW, amount: 20 } as any),
    ).rejects.toThrow(BadRequestException);
  });
});
