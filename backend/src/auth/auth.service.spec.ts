import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';

// 갱신 토큰 검증·로그인 세션/새 기기 감지 로직 회귀 테스트.
// Jwt/Prisma/Push 는 가짜로 대체해 분기만 검증.
describe('AuthService', () => {
  let prisma: any;
  let jwt: any;
  let push: any;
  const svc = () => new AuthService(jwt, prisma, push);

  beforeEach(() => {
    jwt = {
      sign: jest.fn((payload: any) => `tok:${payload.type}:${payload.sub}`),
      verify: jest.fn(),
      decode: jest.fn(),
    };
    prisma = {
      user: { upsert: jest.fn(), findUnique: jest.fn(), delete: jest.fn() },
      loginSession: {
        count: jest.fn(),
        findFirst: jest.fn(),
        updateMany: jest.fn(),
        update: jest.fn(),
        create: jest.fn().mockResolvedValue({ id: 1 }),
      },
      refreshToken: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      notification: { create: jest.fn() },
      $transaction: jest.fn((ops: any[]) => Promise.all(ops)),
    };
    push = { sendToUser: jest.fn() };
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

    it('jti 가 폐기된 상태면 Unauthorized', async () => {
      jwt.verify.mockReturnValue({ sub: 1, jti: 'revoked', type: 'refresh' });
      prisma.refreshToken.findUnique.mockResolvedValue({ id: 1, user_id: 1, session_id: null, revoked_at: new Date() });
      await expect(svc().refresh('x')).rejects.toThrow(UnauthorizedException);
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
      expect(prisma.refreshToken.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 1 }, data: expect.objectContaining({ revoked_at: expect.any(Date) }) }),
      );
      expect(prisma.refreshToken.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ user_id: 7, session_id: 9 }) }),
      );
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
      expect(prisma.notification.create).not.toHaveBeenCalled();
      expect(push.sendToUser).not.toHaveBeenCalled();
    });

    it('기존 세션 있던 사용자의 새 기기 로그인 → 알림 + 푸시', async () => {
      prisma.user.upsert.mockResolvedValue(user);
      prisma.loginSession.count.mockResolvedValue(2);
      prisma.loginSession.findFirst.mockResolvedValue(null);
      await svc().login(gUser, { ip: '1.2.3.4', userAgent: 'iPhone Safari' });
      expect(prisma.notification.create).toHaveBeenCalled();
      expect(push.sendToUser).toHaveBeenCalled();
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
});
