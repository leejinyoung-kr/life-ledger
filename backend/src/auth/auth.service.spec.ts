import { createHash } from 'node:crypto';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { env } from '../config/env';
import { AuthService } from './auth.service';

// 갱신 토큰 검증·로그인 세션/새 기기 감지 로직 회귀 테스트.
// Jwt/Prisma/Push 는 가짜로 대체해 분기만 검증. 시크릿 등 설정값은 test/setup-env.ts 의 고정값
describe('AuthService', () => {
  let prisma: any;
  let jwt: any;
  let notification: any;
  let mail: any;
  let accessLog: any;
  const svc = () => new AuthService(jwt, prisma, notification, mail, accessLog);

  beforeEach(() => {
    jwt = {
      sign: jest.fn((payload: any) => `tok:${payload.type}:${payload.sub}`),
      verify: jest.fn(),
      decode: jest.fn(),
    };
    mail = { isEnabled: true, sendLoginCode: jest.fn().mockResolvedValue(true) };
    prisma = {
      user: { upsert: jest.fn(), findUnique: jest.fn(), delete: jest.fn() },
      loginSession: {
        count: jest.fn(),
        findFirst: jest.fn(),
        updateMany: jest.fn(),
        update: jest.fn(),
        create: jest.fn().mockResolvedValue({ id: 1 }),
        findUnique: jest.fn().mockResolvedValue(null),
      },
      refreshToken: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      userSettings: { findUnique: jest.fn().mockResolvedValue(null) },
      notification: { create: jest.fn() },
      pushSubscription: { deleteMany: jest.fn() },
      // 배열(일괄)과 콜백(interactive) 두 형태 — 콜백은 같은 가짜 prisma 를 tx 로 넘긴다
      $transaction: jest.fn((arg: any) => (typeof arg === 'function' ? arg(prisma) : Promise.all(arg))),
    };
    prisma.refreshToken.updateMany.mockResolvedValue({ count: 1 });
    notification = { createWithPush: jest.fn().mockResolvedValue({ id: 1 }) };
    accessLog = { log: jest.fn().mockResolvedValue(undefined) };
  });

  describe('refresh', () => {
    it('토큰 없으면 Unauthorized', async () => {
      await expect(svc().refresh('')).rejects.toThrow(UnauthorizedException);
    });

    it('검증 실패면 Unauthorized', async () => {
      jwt.verify.mockImplementation(() => {
        throw new Error('bad');
      });
      await expect(svc().refresh('x')).rejects.toThrow(UnauthorizedException);
    });

    it('type 이 refresh 가 아니면 Unauthorized', async () => {
      jwt.verify.mockReturnValue({ sub: 1, type: 'access' });
      await expect(svc().refresh('x')).rejects.toThrow(UnauthorizedException);
    });

    it('jti 가 화이트리스트에 없으면 Unauthorized', async () => {
      jwt.verify.mockReturnValue({ sub: 1, jti: 'missing', type: 'refresh' });
      prisma.refreshToken.findUnique.mockResolvedValue(null);
      await expect(svc().refresh('x')).rejects.toThrow(UnauthorizedException);
    });

    it('로그아웃 · 세션 끊기로 폐기된 토큰(replaced_by 없음)이면 Unauthorized — 세션은 건드리지 않는다', async () => {
      jwt.verify.mockReturnValue({ sub: 1, jti: 'revoked', type: 'refresh' });
      prisma.refreshToken.findUnique.mockResolvedValue({ id: 1, user_id: 1, session_id: 9, revoked_at: new Date(), replaced_by: null });
      prisma.user.findUnique.mockResolvedValue({ id: 1 });
      await expect(svc().refresh('x')).rejects.toThrow(UnauthorizedException);
      expect(prisma.loginSession.updateMany).not.toHaveBeenCalled();
      expect(accessLog.log).not.toHaveBeenCalled();
    });

    it('사용자 없으면 Unauthorized', async () => {
      jwt.verify.mockReturnValue({ sub: 1, jti: 'valid', type: 'refresh' });
      prisma.refreshToken.findUnique.mockResolvedValue({ id: 1, user_id: 1, session_id: null, revoked_at: null });
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(svc().refresh('x')).rejects.toThrow(UnauthorizedException);
    });

    it('정상 → rotation 후 새 access/refresh 토큰 발급 + 이전 jti 폐기', async () => {
      jwt.verify.mockReturnValue({ sub: 7, jti: 'old-jti', type: 'refresh' });
      prisma.refreshToken.findUnique.mockResolvedValue({ id: 1, user_id: 7, session_id: 9, revoked_at: null });
      prisma.user.findUnique.mockResolvedValue({ id: 7, google_id: 'g', email: 'e', name: 'n', picture: 'p' });

      const out = await svc().refresh('x');

      expect(out.access).toBe('tok:access:7');
      expect(out.refresh).toBe('tok:refresh:7');
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 1, revoked_at: null },
          data: expect.objectContaining({ revoked_at: expect.any(Date), replaced_by: expect.any(String) }),
        }),
      );
      expect(prisma.refreshToken.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ user_id: 7, session_id: 9 }) }),
      );
      // 회전으로 남긴 replaced_by 가 새로 만든 토큰의 jti 다
      const replacedBy = prisma.refreshToken.updateMany.mock.calls[0][0].data.replaced_by;
      expect(prisma.refreshToken.create.mock.calls[0][0].data.jti).toBe(replacedBy);
    });

    describe('회전된 옛 토큰 재사용', () => {
      const user = { id: 7, google_id: 'g', email: 'e', name: 'n', picture: 'p' };
      const ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Mobile Safari';
      const rotatedAgo = (ms: number) => ({
        id: 1, user_id: 7, session_id: 9, jti: 'old-jti', revoked_at: new Date(Date.now() - ms), replaced_by: 'new-jti',
      });
      const successor = { id: 2, user_id: 7, session_id: 9, jti: 'new-jti', revoked_at: null, expires_at: new Date(Date.now() + 60_000) };

      beforeEach(() => {
        jwt.verify.mockReturnValue({ sub: 7, jti: 'old-jti', type: 'refresh' });
        prisma.user.findUnique.mockResolvedValue(user);
      });

      it('15초 안이면 이어 받은 새 토큰(같은 jti)으로 다시 서명 + 접근 기록, 새 행은 만들지 않는다', async () => {
        prisma.refreshToken.findUnique.mockImplementation(({ where }: any) =>
          Promise.resolve(where.jti === 'new-jti' ? successor : rotatedAgo(3_000)));

        const out = await svc().refresh('x', { ip: '1.2.3.4', userAgent: ua });

        expect(out.access).toBe('tok:access:7');
        expect(jwt.sign).toHaveBeenCalledWith(
          expect.objectContaining({ type: 'refresh', jti: 'new-jti' }),
          expect.objectContaining({ expiresIn: expect.any(Number) }),
        );
        expect(out.refreshTtlMs).toBeGreaterThan(0);
        expect(out.refreshTtlMs).toBeLessThanOrEqual(60_000);
        expect(prisma.refreshToken.create).not.toHaveBeenCalled();
        expect(accessLog.log).toHaveBeenCalledWith(
          7, 'refresh_grace', expect.objectContaining({ type: 'security', id: 9 }), { ip: '1.2.3.4', userAgent: ua },
        );
        expect(prisma.loginSession.updateMany).not.toHaveBeenCalled();
      });

      it('15초가 지났으면 세션 · 그 세션 refresh 토큰 · 푸시 구독을 끊고 Unauthorized + 접근 기록', async () => {
        prisma.refreshToken.findUnique.mockResolvedValue(rotatedAgo(16_000));

        await expect(svc().refresh('x', { userAgent: ua })).rejects.toThrow(UnauthorizedException);

        expect(prisma.loginSession.updateMany).toHaveBeenCalledWith(
          expect.objectContaining({ where: { id: 9, revoked_at: null } }),
        );
        expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith(
          expect.objectContaining({ where: { session_id: 9, revoked_at: null } }),
        );
        expect(prisma.pushSubscription.deleteMany).toHaveBeenCalledWith({ where: { session_id: 9 } });
        expect(accessLog.log).toHaveBeenCalledWith(7, 'refresh_reuse', expect.objectContaining({ id: 9 }), { userAgent: ua });
        expect(jwt.sign).not.toHaveBeenCalled();
      });

      it('15초가 지나 세션을 끊으면 끊긴 기기 이름으로 경고 알림 + 푸시(보안 화면으로)', async () => {
        prisma.refreshToken.findUnique.mockResolvedValue(rotatedAgo(16_000));
        prisma.loginSession.findUnique.mockResolvedValue({ device: 'iOS · Safari' });

        await expect(svc().refresh('x')).rejects.toThrow(UnauthorizedException);

        expect(notification.createWithPush).toHaveBeenCalledWith(
          7,
          expect.objectContaining({ group: 'system', tone: 'warning', description: expect.stringContaining('iOS · Safari') }),
          expect.objectContaining({ url: '/security' }),
        );
      });

      it('알림이 실패해도 세션은 끊기고 응답은 401 그대로', async () => {
        prisma.refreshToken.findUnique.mockResolvedValue(rotatedAgo(16_000));
        notification.createWithPush.mockRejectedValue(new Error('db down'));

        await expect(svc().refresh('x')).rejects.toThrow(UnauthorizedException);

        expect(prisma.loginSession.updateMany).toHaveBeenCalled();
      });

      it('15초 안 허용에서는 알림을 보내지 않는다', async () => {
        prisma.refreshToken.findUnique.mockImplementation(({ where }: any) =>
          Promise.resolve(where.jti === 'new-jti' ? successor : rotatedAgo(3_000)));

        await svc().refresh('x');

        expect(notification.createWithPush).not.toHaveBeenCalled();
      });

      it('15초 안이어도 새 토큰이 그새 폐기됐으면 Unauthorized — 세션은 끊지 않는다', async () => {
        prisma.refreshToken.findUnique.mockImplementation(({ where }: any) =>
          Promise.resolve(where.jti === 'new-jti' ? { ...successor, revoked_at: new Date() } : rotatedAgo(3_000)));

        await expect(svc().refresh('x')).rejects.toThrow(UnauthorizedException);

        expect(prisma.loginSession.updateMany).not.toHaveBeenCalled();
        expect(accessLog.log).not.toHaveBeenCalled();
      });

      it('세션 없는 토큰이 15초 뒤 재사용되면 이어 받은 새 토큰만 끊는다', async () => {
        prisma.refreshToken.findUnique.mockResolvedValue({ ...rotatedAgo(20_000), session_id: null });

        await expect(svc().refresh('x')).rejects.toThrow(UnauthorizedException);

        expect(prisma.loginSession.updateMany).not.toHaveBeenCalled();
        expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith(
          expect.objectContaining({ where: { jti: 'new-jti', revoked_at: null } }),
        );
      });
    });

    it('같은 토큰으로 동시에 갱신하면 먼저 폐기한 요청만 새 행을 만들고, 진 요청은 이긴 요청의 새 토큰으로 이어 받는다', async () => {
      jwt.verify.mockReturnValue({ sub: 7, jti: 'old-jti', type: 'refresh' });
      prisma.user.findUnique.mockResolvedValue({ id: 7, google_id: 'g', email: 'e', name: 'n', picture: 'p' });
      prisma.refreshToken.updateMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });
      // 두 요청 모두 처음엔 폐기 전으로 읽고, 진 요청이 다시 읽을 때는 이긴 요청의 회전 결과가 보인다
      let oldReads = 0;
      prisma.refreshToken.findUnique.mockImplementation(({ where }: any) => {
        if (where.jti === 'old-jti') {
          oldReads += 1;
          return Promise.resolve(oldReads <= 2
            ? { id: 1, user_id: 7, session_id: 9, jti: 'old-jti', revoked_at: null, replaced_by: null }
            : { id: 1, user_id: 7, session_id: 9, jti: 'old-jti', revoked_at: new Date(), replaced_by: 'winner-jti' });
        }
        return Promise.resolve({ id: 2, user_id: 7, session_id: 9, jti: 'winner-jti', revoked_at: null, expires_at: new Date(Date.now() + 60_000) });
      });

      const results = await Promise.allSettled([svc().refresh('x'), svc().refresh('x')]);

      expect(results.map((r) => r.status)).toEqual(['fulfilled', 'fulfilled']);
      expect(prisma.refreshToken.create).toHaveBeenCalledTimes(1);
      expect(accessLog.log).toHaveBeenCalledWith(7, 'refresh_grace', expect.anything(), undefined);
    });
  });

  describe('logout', () => {
    it('토큰 없으면 아무 동작 없음', async () => {
      await svc().logout(undefined);
      expect(prisma.refreshToken.updateMany).not.toHaveBeenCalled();
    });

    it('jti 디코드되면 화이트리스트에서 폐기', async () => {
      jwt.verify.mockReturnValue({ jti: 'abc' });
      await svc().logout('x');
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { jti: 'abc', revoked_at: null } }),
      );
    });

    it('세션에 묶인 토큰이면 그 기기의 푸시 구독도 지운다', async () => {
      jwt.verify.mockReturnValue({ jti: 'abc' });
      prisma.refreshToken.findUnique.mockResolvedValue({ session_id: 9 });
      await svc().logout('x');
      expect(prisma.pushSubscription.deleteMany).toHaveBeenCalledWith({ where: { session_id: 9 } });
    });

    it('세션 없는 토큰이면 푸시 구독은 건드리지 않는다', async () => {
      jwt.verify.mockReturnValue({ jti: 'abc' });
      prisma.refreshToken.findUnique.mockResolvedValue({ session_id: null });
      await svc().logout('x');
      expect(prisma.pushSubscription.deleteMany).not.toHaveBeenCalled();
    });

    it('검증 실패해도 decode 결과의 jti 로 폐기 시도', async () => {
      jwt.verify.mockImplementation(() => {
        throw new Error('expired');
      });
      jwt.decode.mockReturnValue({ jti: 'expired-jti' });
      await svc().logout('x');
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { jti: 'expired-jti', revoked_at: null } }),
      );
    });
  });

  describe('login', () => {
    const gUser = { googleId: 'g1', email: 'e', name: 'n', picture: 'p' };
    const user = { id: 3, google_id: 'g1', email: 'e', name: 'n', picture: 'p' };

    it('client 없으면 세션 미기록 + access/refresh 발급', async () => {
      prisma.user.upsert.mockResolvedValue(user);
      const out = await svc().login(gUser);
      expect(out.access).toBe('tok:access:3');
      expect(out.refresh).toBe('tok:refresh:3');
      expect(prisma.loginSession.count).not.toHaveBeenCalled();
      expect(prisma.refreshToken.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ user_id: 3, session_id: null }) }),
      );
    });

    it('최초 로그인(prior=0)은 새 기기 알림/푸시 없음', async () => {
      prisma.user.upsert.mockResolvedValue(user);
      prisma.loginSession.count.mockResolvedValue(0);
      prisma.loginSession.findFirst.mockResolvedValue(null);
      await svc().login(gUser, { ip: '1.2.3.4', userAgent: 'Mozilla Chrome Windows' });
      expect(prisma.loginSession.create).toHaveBeenCalled();
      expect(notification.createWithPush).not.toHaveBeenCalled();
    });

    it('기존 세션 있던 사용자의 새 기기 로그인 → 알림 + 푸시', async () => {
      prisma.user.upsert.mockResolvedValue(user);
      prisma.loginSession.count.mockResolvedValue(2);
      prisma.loginSession.findFirst.mockResolvedValue(null);
      await svc().login(gUser, { ip: '1.2.3.4', userAgent: 'iPhone Safari' });
      // 알림 저장과 푸시 적재는 한 트랜잭션에서 함께 처리된다
      expect(notification.createWithPush).toHaveBeenCalledWith(
        user.id,
        expect.objectContaining({ title: '새 기기에서 로그인' }),
        expect.objectContaining({ url: '/security' }),
      );
    });

    it('access 는 iss/aud 를 넣어 기본 시크릿으로, refresh 는 refresh 전용 시크릿으로 서명', async () => {
      prisma.user.upsert.mockResolvedValue(user);
      await svc().login(gUser);
      expect(jwt.sign).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'access' }),
        { expiresIn: '15m', issuer: 'life-moa', audience: 'life-moa' },
      );
      expect(jwt.sign).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'refresh' }),
        expect.objectContaining({ secret: env.JWT_REFRESH_SECRET }),
      );
    });

    it('동일 기기 재로그인 → 기존 세션 갱신, create 없음', async () => {
      prisma.user.upsert.mockResolvedValue(user);
      prisma.loginSession.count.mockResolvedValue(1);
      prisma.loginSession.findFirst.mockResolvedValue({ id: 99 });
      await svc().login(gUser, { ip: '1.2.3.4', userAgent: 'iPhone Safari' });
      expect(prisma.loginSession.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 99 } }));
      expect(prisma.loginSession.create).not.toHaveBeenCalled();
      expect(prisma.refreshToken.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ session_id: 99 }) }),
      );
    });
  });

  // 가짜 대신 실제 JwtService 로 서명·검증해 "용도별 시크릿 분리"가 실제로 토큰을 가르는지 확인
  describe('토큰 시크릿 분리 (실제 JwtService)', () => {
    const ACCESS_SECRET = env.JWT_SECRET;
    const REFRESH_SECRET = env.JWT_REFRESH_SECRET;
    const gUser = { googleId: 'g1', email: 'e', name: 'n', picture: 'p' };
    const user = { id: 3, google_id: 'g1', email: 'e', name: 'n', picture: 'p' };
    let realJwt: JwtService;

    beforeEach(() => {
      realJwt = new JwtService({ secret: ACCESS_SECRET });
      jwt = realJwt;
      prisma.user.upsert.mockResolvedValue(user);
      prisma.user.findUnique.mockResolvedValue(user);
    });

    it('refresh 토큰은 access 시크릿으로 검증되지 않는다 (보호 API 에서 통과 불가)', async () => {
      const { refresh } = await svc().login(gUser);
      expect(() => realJwt.verify(refresh)).toThrow();
      expect(realJwt.verify(refresh, { secret: REFRESH_SECRET }).type).toBe('refresh');
    });

    it('access 토큰은 iss/aud 가 life-moa 이고, 갱신 토큰으로 쓰면 서명 단계에서 거부된다', async () => {
      const { access } = await svc().login(gUser);
      const payload = realJwt.verify(access, { issuer: 'life-moa', audience: 'life-moa' });
      expect(payload.type).toBe('access');
      await expect(svc().refresh(access)).rejects.toThrow(UnauthorizedException);
      expect(prisma.refreshToken.findUnique).not.toHaveBeenCalled();
    });

    it('정상 refresh 토큰이면 rotation 성공', async () => {
      const { refresh } = await svc().login(gUser);
      prisma.refreshToken.findUnique.mockResolvedValue({ id: 1, user_id: 3, session_id: null, revoked_at: null });
      const next = await svc().refresh(refresh);
      expect(realJwt.verify(next.access, { issuer: 'life-moa', audience: 'life-moa' }).sub).toBe(3);
    });

    it('refresh 시크릿이 맞아도 HS256 이 아닌 알고리즘이면 거부', async () => {
      const forged = realJwt.sign(
        { sub: 3, jti: 'x', type: 'refresh' },
        { secret: REFRESH_SECRET, algorithm: 'HS512' },
      );
      await expect(svc().refresh(forged)).rejects.toThrow(UnauthorizedException);
      expect(prisma.refreshToken.findUnique).not.toHaveBeenCalled();
    });
  });

  // 이메일 코드 로그인 — 발급 상한·실패 문구 통일(열거 방지)·조건부 시도 증가 회귀 테스트
  describe('이메일 코드', () => {
    const ALLOWED = 'tester@example.com';
    const hash = (c: string) => createHash('sha256').update(c).digest('hex');
    const live = (over: any = {}) => ({
      id: 7,
      code_hash: hash('123456'),
      attempts: 0,
      expires_at: new Date(Date.now() + 60_000),
      ...over,
    });

    beforeEach(() => {
      prisma.emailLoginCode = {
        count: jest.fn().mockResolvedValue(0),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        create: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      };
      prisma.user.upsert.mockResolvedValue({ id: 3, email: ALLOWED, name: 'tester', picture: null });
    });

    it('허용 이메일이면 코드를 저장하고 메일을 보낸다', async () => {
      await expect(svc().requestEmailCode(ALLOWED)).resolves.toEqual({ ok: true });
      expect(prisma.emailLoginCode.create).toHaveBeenCalled();
      expect(mail.sendLoginCode).toHaveBeenCalledWith(ALLOWED, expect.stringMatching(/^\d{6}$/));
    });

    it('발급 상한을 넘으면 같은 응답이지만 코드를 만들지 않는다', async () => {
      prisma.emailLoginCode.count.mockResolvedValue(5);
      await expect(svc().requestEmailCode(ALLOWED)).resolves.toEqual({ ok: true });
      expect(prisma.emailLoginCode.create).not.toHaveBeenCalled();
      expect(mail.sendLoginCode).not.toHaveBeenCalled();
    });

    it('허용되지 않은 이메일도 같은 응답이고 DB·메일을 건드리지 않는다', async () => {
      await expect(svc().requestEmailCode('other@example.com')).resolves.toEqual({ ok: true });
      expect(prisma.emailLoginCode.count).not.toHaveBeenCalled();
      expect(mail.sendLoginCode).not.toHaveBeenCalled();
    });

    it('검증 실패는 허용 여부·코드 유무·불일치와 무관하게 같은 400 문구', async () => {
      const messages: string[] = [];
      const capture = async (p: Promise<unknown>) => {
        const err = await p.catch((e: unknown) => e);
        expect(err).toBeInstanceOf(BadRequestException);
        messages.push((err as BadRequestException).message);
      };
      await capture(svc().verifyEmailCode('other@example.com', '123456'));
      prisma.emailLoginCode.findFirst.mockResolvedValueOnce(null);
      await capture(svc().verifyEmailCode(ALLOWED, '123456'));
      prisma.emailLoginCode.findFirst.mockResolvedValueOnce(live());
      await capture(svc().verifyEmailCode(ALLOWED, '000000'));
      expect(new Set(messages).size).toBe(1);
    });

    it('시도 상한에 걸리면(조건부 증가 count 0) 맞는 코드여도 거부하고 코드를 무효화한다', async () => {
      prisma.emailLoginCode.findFirst.mockResolvedValue(live({ attempts: 5 }));
      prisma.emailLoginCode.updateMany.mockResolvedValueOnce({ count: 0 });
      await expect(svc().verifyEmailCode(ALLOWED, '123456')).rejects.toThrow(BadRequestException);
      expect(prisma.user.upsert).not.toHaveBeenCalled();
    });

    it('맞는 코드면 코드를 소비하고 토큰을 발급한다', async () => {
      prisma.emailLoginCode.findFirst.mockResolvedValue(live());
      const out = await svc().verifyEmailCode(ALLOWED, '123456');
      expect(out.access).toBeDefined();
      expect(prisma.emailLoginCode.updateMany).toHaveBeenLastCalledWith(
        expect.objectContaining({ where: { id: 7, consumed_at: null } }),
      );
    });

    it('같은 코드로 동시에 성공해도 소비는 한 번뿐 — 뒤 요청은 거부', async () => {
      prisma.emailLoginCode.findFirst.mockResolvedValue(live());
      prisma.emailLoginCode.updateMany
        .mockResolvedValueOnce({ count: 1 }) // 시도 증가
        .mockResolvedValueOnce({ count: 0 }); // 소비 — 이미 다른 요청이 소비함
      await expect(svc().verifyEmailCode(ALLOWED, '123456')).rejects.toThrow(BadRequestException);
      expect(prisma.user.upsert).not.toHaveBeenCalled();
    });
  });
});
