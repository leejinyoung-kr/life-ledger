import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { VaultService } from './vault.service';

// 마스터 잠금 비번 해시(scrypt)·잠금해제 토큰 발급 로직 회귀 테스트.
// PrismaService/JwtService 는 인메모리 가짜로 대체해 순수 로직만 검증.
describe('VaultService (마스터 잠금)', () => {
  let row: any;

  const prisma: any = {
    userSettings: {
      findUnique: jest.fn(async () => row),
      create: jest.fn(async ({ data }: any) => (row = { ...row, ...data })),
      update: jest.fn(async ({ data }: any) => (row = { ...row, ...data })),
    },
  };
  const jwt: any = { sign: jest.fn(() => 'signed-token') };
  const accessLog: any = { log: jest.fn(async () => {}) };
  const svc = () => new VaultService(prisma, jwt, accessLog);

  beforeEach(() => {
    row = {
      user_id: 1,
      master_lock_enabled: false,
      master_lock_hash: null,
      master_lock_timeout: 5,
      categories: {},
      widgets: {},
    };
    jest.clearAllMocks();
  });

  it('setup: 8자 미만 비번 거부', async () => {
    await expect(svc().setup(1, '1234567', 5)).rejects.toThrow(BadRequestException);
  });

  it('setup 후 saltHex:hashHex 형태로 해시 저장 + 활성화', async () => {
    await svc().setup(1, 'master-pw', 10);
    expect(row.master_lock_enabled).toBe(true);
    expect(row.master_lock_hash).toMatch(/^[0-9a-f]+:[0-9a-f]+$/);
  });

  it('unlock: 올바른 비번이면 토큰 + 만료시간(분→초) 발급', async () => {
    const s = svc();
    await s.setup(1, 'master-pw', 10);
    const res = await s.unlock(1, 'master-pw');
    expect(res.token).toBe('signed-token');
    expect(res.expiresIn).toBe(600); // 10분 = 600초
    // access 와 구분되는 type — Bearer 로 넣어도 JwtStrategy 가 거부하게
    expect(jwt.sign).toHaveBeenCalledWith({ sub: 1, type: 'vault' }, { expiresIn: 600 });
  });

  it('unlock: 틀린 비번 거부', async () => {
    const s = svc();
    await s.setup(1, 'master-pw', 5);
    await expect(s.unlock(1, 'wrong-pw')).rejects.toThrow(ForbiddenException);
  });

  it('unlock: 잠금 미설정이면 거부', async () => {
    await expect(svc().unlock(1, 'x')).rejects.toThrow(BadRequestException);
  });

  it('disable: 틀린 비번 거부, 맞으면 해제 + 해시 제거', async () => {
    const s = svc();
    await s.setup(1, 'master-pw', 5);
    await expect(s.disable(1, 'wrong')).rejects.toThrow(ForbiddenException);
    await s.disable(1, 'master-pw');
    expect(row.master_lock_enabled).toBe(false);
    expect(row.master_lock_hash).toBeNull();
  });

  it('timeout 0(수동 잠금만) → 12시간 TTL', async () => {
    const s = svc();
    await s.setup(1, 'master-pw', 0);
    const res = await s.unlock(1, 'master-pw');
    expect(res.expiresIn).toBe(12 * 3600);
  });

  it('같은 비번도 매번 다른 salt → 다른 해시', async () => {
    const s = svc();
    await s.setup(1, 'master-pw', 5);
    const h1 = row.master_lock_hash;
    await s.setup(1, 'master-pw', 5);
    expect(row.master_lock_hash).not.toBe(h1);
  });
});
