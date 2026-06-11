import { ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { VaultGuard } from './vault.guard';

// 마스터 잠금 핵심 가드 — 미설정/비활성/토큰누락/잘못된 토큰/정상 토큰 분기 회귀 테스트.
describe('VaultGuard', () => {
  let prisma: any;
  let jwt: any;

  const ctx = (user: any, headers: Record<string, any> = {}): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({ user, headers }),
      }),
    }) as any;

  beforeEach(() => {
    prisma = { userSettings: { findUnique: jest.fn() } };
    jwt = { verify: jest.fn() };
  });

  const guard = () => new VaultGuard(prisma, jwt);

  it('인증되지 않은 요청(req.user 없음)은 통과시킨다', async () => {
    await expect(guard().canActivate(ctx(undefined))).resolves.toBe(true);
    expect(prisma.userSettings.findUnique).not.toHaveBeenCalled();
  });

  it('마스터 잠금 미설정(설정 없음)이면 통과시킨다', async () => {
    prisma.userSettings.findUnique.mockResolvedValue(null);
    await expect(guard().canActivate(ctx({ id: 1 }))).resolves.toBe(true);
  });

  it('마스터 잠금 비활성화면 통과시킨다', async () => {
    prisma.userSettings.findUnique.mockResolvedValue({ master_lock_enabled: false });
    await expect(guard().canActivate(ctx({ id: 1 }))).resolves.toBe(true);
  });

  it('잠금 활성 + 토큰 없음 -> 423 LOCKED', async () => {
    prisma.userSettings.findUnique.mockResolvedValue({ master_lock_enabled: true });
    const promise = guard().canActivate(ctx({ id: 1 }));
    await expect(promise).rejects.toThrow(HttpException);
    await expect(promise).rejects.toMatchObject({
      status: HttpStatus.LOCKED,
      response: expect.objectContaining({ code: 'VAULT_LOCKED' }),
    });
  });

  it('잠금 활성 + 토큰 검증 실패 -> 423 LOCKED', async () => {
    prisma.userSettings.findUnique.mockResolvedValue({ master_lock_enabled: true });
    jwt.verify.mockImplementation(() => {
      throw new Error('invalid token');
    });
    const promise = guard().canActivate(ctx({ id: 1 }, { 'x-vault-token': 'bad' }));
    await expect(promise).rejects.toMatchObject({ status: HttpStatus.LOCKED });
  });

  it('잠금 활성 + scope 가 vault 가 아니면 -> 423 LOCKED', async () => {
    prisma.userSettings.findUnique.mockResolvedValue({ master_lock_enabled: true });
    jwt.verify.mockReturnValue({ sub: 1, scope: 'access' });
    const promise = guard().canActivate(ctx({ id: 1 }, { 'x-vault-token': 'tok' }));
    await expect(promise).rejects.toMatchObject({ status: HttpStatus.LOCKED });
  });

  it('잠금 활성 + 다른 사용자(sub 불일치) 토큰이면 -> 423 LOCKED', async () => {
    prisma.userSettings.findUnique.mockResolvedValue({ master_lock_enabled: true });
    jwt.verify.mockReturnValue({ sub: 2, scope: 'vault' });
    const promise = guard().canActivate(ctx({ id: 1 }, { 'x-vault-token': 'tok' }));
    await expect(promise).rejects.toMatchObject({ status: HttpStatus.LOCKED });
  });

  it('잠금 활성 + 본인 vault 토큰이면 통과시킨다', async () => {
    prisma.userSettings.findUnique.mockResolvedValue({ master_lock_enabled: true });
    jwt.verify.mockReturnValue({ sub: 1, scope: 'vault' });
    await expect(guard().canActivate(ctx({ id: 1 }, { 'x-vault-token': 'tok' }))).resolves.toBe(true);
  });

  it('헤더가 배열로 전달되어도 첫 번째 값을 토큰으로 사용한다', async () => {
    prisma.userSettings.findUnique.mockResolvedValue({ master_lock_enabled: true });
    jwt.verify.mockReturnValue({ sub: 1, scope: 'vault' });
    await expect(guard().canActivate(ctx({ id: 1 }, { 'x-vault-token': ['tok', 'extra'] }))).resolves.toBe(true);
    expect(jwt.verify).toHaveBeenCalledWith('tok');
  });
});
