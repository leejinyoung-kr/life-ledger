import { NotFoundException } from '@nestjs/common';
import { EnvService } from './env.service';
import { CryptoService } from '../common/crypto.service';

// ENV 보관함 — reveal/export/diff 감사 로그 기록, 값 마스킹, 이력/롤백 회귀 테스트.
// CryptoService 는 실제 사용(라운드트립 검증), Prisma/AccessLog 는 인메모리 가짜.
describe('EnvService', () => {
  const ORIGINAL = process.env.CREDENTIAL_SECRET;
  beforeAll(() => {
    process.env.CREDENTIAL_SECRET = 'unit-test-secret';
  });
  afterAll(() => {
    process.env.CREDENTIAL_SECRET = ORIGINAL;
  });

  let projects: any[];
  let vars: any[];
  let history: any[];
  let seq: number;
  let prisma: any;
  let accessLog: any;
  const crypto = new CryptoService();
  const svc = () => new EnvService(prisma, crypto, accessLog);

  beforeEach(() => {
    seq = 1;
    projects = [{ id: 1, user_id: 1, name: 'proj', description: null, deleted_at: null, updated_at: new Date() }];
    vars = [];
    history = [];
    accessLog = { log: jest.fn() };
    prisma = {
      envProject: {
        findFirst: jest.fn(async ({ where }: any) =>
          projects.find((p) => p.id === where.id && p.user_id === where.user_id && p.deleted_at == null) ?? null,
        ),
      },
      envVar: {
        findFirst: jest.fn(async ({ where }: any) =>
          vars.find((v) => v.id === where.id && v.user_id === where.user_id && v.deleted_at == null) ?? null,
        ),
        findMany: jest.fn(async ({ where }: any) =>
          vars.filter(
            (v) =>
              v.user_id === where.user_id &&
              v.project_id === where.project_id &&
              v.env === where.env &&
              v.deleted_at == null,
          ),
        ),
        update: jest.fn(async ({ where, data }: any) => {
          const row = vars.find((v) => v.id === where.id);
          Object.assign(row, data);
          return row;
        }),
      },
      envVarHistory: {
        create: jest.fn(async ({ data }: any) => {
          const row = { id: seq++, created_at: new Date(), ...data };
          history.push(row);
          return row;
        }),
        findMany: jest.fn(async ({ where, orderBy, skip, select }: any) => {
          let rows = history.filter((h) => h.env_var_id === where.env_var_id);
          rows = rows.sort((a, b) => b.created_at.getTime() - a.created_at.getTime());
          if (skip) rows = rows.slice(skip);
          if (select) rows = rows.map((r) => ({ id: r.id }));
          return rows;
        }),
        findFirst: jest.fn(async ({ where }: any) =>
          history.find((h) => h.id === where.id && h.env_var_id === where.env_var_id && h.user_id === where.user_id) ?? null,
        ),
        deleteMany: jest.fn(async ({ where }: any) => {
          const ids: number[] = where.id.in;
          history = history.filter((h) => !ids.includes(h.id));
        }),
      },
    };
  });

  const addVar = (overrides: Partial<any> = {}) => {
    const row = {
      id: seq++,
      user_id: 1,
      project_id: 1,
      env: 'dev',
      group: null,
      key: 'KEY',
      value_enc: crypto.encrypt('secret-value'),
      memo: null,
      deleted_at: null,
      ...overrides,
    };
    vars.push(row);
    return row;
  };

  describe('revealVar', () => {
    it('원문을 복호화해 반환하고 env_reveal 감사 로그를 남긴다', async () => {
      const row = addVar();
      const result = await svc().revealVar(1, row.id, { ip: '1.1.1.1' } as any);
      expect(result.value).toBe('secret-value');
      expect(accessLog.log).toHaveBeenCalledWith(
        1,
        'env_reveal',
        expect.objectContaining({ type: 'env', id: row.id, name: 'KEY' }),
        { ip: '1.1.1.1' },
      );
    });

    it('본인 소유가 아니면 NotFoundException', async () => {
      const row = addVar({ user_id: 2 });
      await expect(svc().revealVar(1, row.id)).rejects.toThrow(NotFoundException);
    });
  });

  describe('exportVars', () => {
    it('환경의 모든 변수를 평문으로 반환하고 env_reveal 감사 로그(export:)를 남긴다', async () => {
      addVar({ key: 'A', value_enc: crypto.encrypt('a-val') });
      addVar({ key: 'B', value_enc: crypto.encrypt('b-val') });

      const result = await svc().exportVars(1, 1, 'dev' as any);

      expect(result).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ key: 'A', value: 'a-val' }),
          expect.objectContaining({ key: 'B', value: 'b-val' }),
        ]),
      );
      expect(accessLog.log).toHaveBeenCalledWith(
        1,
        'env_reveal',
        expect.objectContaining({ type: 'env', id: 1, name: expect.stringContaining('export:') }),
        undefined,
      );
    });
  });

  describe('findVars (목록)', () => {
    it('값은 마스킹된 형태로만 노출한다', async () => {
      addVar({ value_enc: crypto.encrypt('secret-value') });
      const [row] = await svc().findVars(1, 1, 'dev' as any);
      expect(row.valueMasked).toBe('•'.repeat(12));
      expect(row).not.toHaveProperty('value');
      expect(row).not.toHaveProperty('value_enc');
    });
  });

  describe('diff', () => {
    it('한쪽에만 있는 키와 값이 다른 키를 분류하고, 평문 값은 노출하지 않는다', async () => {
      addVar({ env: 'dev', key: 'ONLY_DEV', value_enc: crypto.encrypt('x') });
      addVar({ env: 'dev', key: 'SAME', value_enc: crypto.encrypt('same') });
      addVar({ env: 'dev', key: 'DIFF', value_enc: crypto.encrypt('dev-val') });

      addVar({ env: 'prod', key: 'ONLY_PROD', value_enc: crypto.encrypt('y') });
      addVar({ env: 'prod', key: 'SAME', value_enc: crypto.encrypt('same') });
      addVar({ env: 'prod', key: 'DIFF', value_enc: crypto.encrypt('prod-val') });

      const result = await svc().diff(1, 1, 'dev' as any, 'prod' as any);

      expect(result.onlyInBase).toEqual(['ONLY_DEV']);
      expect(result.onlyInTarget).toEqual(['ONLY_PROD']);
      expect(result.valueMismatch).toEqual(['DIFF']);
      expect(result.identical).toBe(false);
      expect(JSON.stringify(result)).not.toContain('dev-val');
      expect(JSON.stringify(result)).not.toContain('prod-val');
    });

    it('차이가 없으면 identical: true 이고 env_reveal 감사 로그(diff:)를 남긴다', async () => {
      addVar({ env: 'dev', key: 'SAME', value_enc: crypto.encrypt('same') });
      addVar({ env: 'prod', key: 'SAME', value_enc: crypto.encrypt('same') });

      const result = await svc().diff(1, 1, 'dev' as any, 'prod' as any);

      expect(result.identical).toBe(true);
      expect(accessLog.log).toHaveBeenCalledWith(
        1,
        'env_reveal',
        expect.objectContaining({ type: 'env', id: 1, name: expect.stringContaining('diff:') }),
        undefined,
      );
    });
  });

  describe('updateVar / 이력 / 롤백', () => {
    it('값이 바뀌면 이전 값을 이력에 보관한다', async () => {
      const row = addVar({ value_enc: crypto.encrypt('old-value') });
      await svc().updateVar(1, row.id, { value: 'new-value' } as any);

      expect(history).toHaveLength(1);
      expect(crypto.decrypt(history[0].value_enc)).toBe('old-value');
      expect(crypto.decrypt(row.value_enc)).toBe('new-value');
    });

    it('값이 그대로면 이력을 추가하지 않는다', async () => {
      const row = addVar({ value_enc: crypto.encrypt('same-value') });
      await svc().updateVar(1, row.id, { value: 'same-value', memo: 'm' } as any);
      expect(history).toHaveLength(0);
    });

    it('이력은 마스킹된 형태로만 노출한다', async () => {
      const row = addVar({ value_enc: crypto.encrypt('old-value') });
      await svc().updateVar(1, row.id, { value: 'new-value' } as any);

      const [h] = await svc().varHistory(1, row.id);
      expect(h.valueMasked).toBe('•'.repeat(9));
      expect(h).not.toHaveProperty('value');
    });

    it('rollbackVar 는 현재 값을 이력에 보관한 뒤 이전 값으로 되돌린다', async () => {
      const row = addVar({ value_enc: crypto.encrypt('v1') });
      await svc().updateVar(1, row.id, { value: 'v2' } as any); // history: v1
      const histId = history[0].id;

      const result = await svc().rollbackVar(1, row.id, histId);

      expect(result.valueMasked).toBe('•'.repeat(2)); // 'v1'.length === 2
      expect(crypto.decrypt(row.value_enc)).toBe('v1');
      // 롤백 직전 값(v2)이 새 이력으로 보관됨
      expect(history.some((h) => crypto.decrypt(h.value_enc) === 'v2')).toBe(true);
    });

    it('존재하지 않는 이력으로 롤백하면 NotFoundException', async () => {
      const row = addVar();
      await expect(svc().rollbackVar(1, row.id, 999)).rejects.toThrow(NotFoundException);
    });

    it('이력은 변수당 최근 20건만 유지한다', async () => {
      const row = addVar({ value_enc: crypto.encrypt('v0') });
      for (let i = 1; i <= 25; i++) {
        await svc().updateVar(1, row.id, { value: `v${i}` } as any);
      }
      expect(history.filter((h) => h.env_var_id === row.id)).toHaveLength(20);
    });
  });
});
