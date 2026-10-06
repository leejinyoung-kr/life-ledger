import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { MAX_FAVORITES, TransactionFavoriteService } from './transaction-favorite.service';

// 즐겨찾기 중복·개수 제한·순서·소유권 검증. Prisma 는 인메모리 가짜.
describe('TransactionFavoriteService', () => {
  let rows: any[];
  let prisma: any;
  const svc = () => new TransactionFavoriteService(prisma);
  const match = (r: any, where: any) =>
    Object.entries(where).every(([k, v]: [string, any]) => {
      if (v && typeof v === 'object' && 'in' in v) return v.in.includes(r[k]);
      if (v && typeof v === 'object' && 'not' in v) return r[k] !== v.not;
      return r[k] === v;
    });

  beforeEach(() => {
    rows = [];
    prisma = {
      transactionFavorite: {
        findMany: jest.fn(async ({ where }: any) =>
          rows.filter((r) => match(r, where)).sort((a, b) => a.sort_order - b.sort_order || a.id - b.id)),
        findFirst: jest.fn(async ({ where, orderBy }: any) => {
          const list = rows.filter((r) => match(r, where));
          if (orderBy?.sort_order === 'desc') list.sort((a, b) => b.sort_order - a.sort_order);
          return list[0] ?? null;
        }),
        count: jest.fn(async ({ where }: any) => rows.filter((r) => match(r, where)).length),
        create: jest.fn(async ({ data }: any) => {
          const row = { id: rows.length + 1, memo: null, ...data };
          rows.push(row);
          return row;
        }),
        update: jest.fn(async ({ where, data }: any) => Object.assign(rows.find((r) => r.id === where.id), data)),
        deleteMany: jest.fn(async ({ where }: any) => {
          const before = rows.length;
          rows = rows.filter((r) => !match(r, where));
          return { count: before - rows.length };
        }),
      },
      $transaction: jest.fn(async (ops: Promise<unknown>[]) => Promise.all(ops)),
    };
  });

  const dto = (o: Partial<any> = {}) => ({ type: 'expense' as const, title: 'GS칼텍스 강남점', category: 'car_fuel', amount: 50000, payMethod: 'card_a', ...o });

  it('추가하면 맨 뒤 순서로 붙는다', async () => {
    await svc().create(1, dto());
    await svc().create(1, dto({ title: 'SK주유소' }));
    const list = await svc().findAll(1);
    expect(list.map((f) => f.title)).toEqual(['GS칼텍스 강남점', 'SK주유소']);
    expect(list[0].amount).toBe(50000);
  });

  it('같은 유형·내역명·카테고리·결제수단은 중복으로 거부한다', async () => {
    await svc().create(1, dto());
    await expect(svc().create(1, dto({ amount: 70000 }))).rejects.toBeInstanceOf(ConflictException);
    await expect(svc().create(1, dto({ payMethod: 'card_b' }))).resolves.toBeDefined();
  });

  it(`${MAX_FAVORITES}개를 넘기면 거부한다`, async () => {
    for (let i = 0; i < MAX_FAVORITES; i++) {
      rows.push({ id: i + 1, user_id: 1, type: 'expense', title: `t${i}`, category: 'c', pay_method: '', sort_order: i, amount: new Prisma.Decimal(1) });
    }
    await expect(svc().create(1, dto())).rejects.toBeInstanceOf(BadRequestException);
  });

  it('순서 변경은 넘긴 id 순서대로 저장하고, 남의 id 가 섞이면 거부한다', async () => {
    await svc().create(1, dto({ title: 'A' }));
    await svc().create(1, dto({ title: 'B' }));
    await svc().create(2, dto({ title: 'C' }));
    const list = await svc().reorder(1, [2, 1]);
    expect(list.map((f) => f.title)).toEqual(['B', 'A']);
    await expect(svc().reorder(1, [1, 3])).rejects.toBeInstanceOf(BadRequestException);
  });

  it('수정은 금액·내역명을 바꾸고, 다른 즐겨찾기와 같아지면 거부한다', async () => {
    await svc().create(1, dto({ title: 'A' }));
    await svc().create(1, dto({ title: 'B' }));
    const updated = await svc().update(1, 1, { title: 'A2', amount: 70000 });
    expect(updated).toMatchObject({ title: 'A2', amount: 70000, category: 'car_fuel' });
    await expect(svc().update(1, 1, { title: 'B' })).rejects.toBeInstanceOf(ConflictException);
    await expect(svc().update(2, 1, { title: 'X' })).rejects.toBeInstanceOf(NotFoundException);
  });

  it('남의 즐겨찾기는 지울 수 없다', async () => {
    await svc().create(2, dto());
    await expect(svc().remove(1, 1)).rejects.toBeInstanceOf(NotFoundException);
    expect(rows).toHaveLength(1);
  });
});
