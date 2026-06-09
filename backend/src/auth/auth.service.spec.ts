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
    };
    prisma = {
      user: { upsert: jest.fn(), findUnique: jest.fn() },
      loginSession: {
        count: jest.fn(),
        findFirst: jest.fn(),
        updateMany: jest.fn(),
        update: jest.fn(),
        create: jest.fn(),
      },
      notification: { create: jest.fn() },
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

    it('사용자 없으면 Unauthorized', async () => {
      jwt.verify.mockReturnValue({ sub: 1, type: 'refresh' });
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(svc().refresh('x')).rejects.toThrow(UnauthorizedException);
    });

    it('정상 → 새 access 토큰 발급', async () => {
      jwt.verify.mockReturnValue({ sub: 7, type: 'refresh' });
      prisma.user.findUnique.mockResolvedValue({ id: 7, google_id: 'g', email: 'e', name: 'n', picture: 'p' });
      expect(await svc().refresh('x')).toBe('tok:access:7');
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
    });
  });
});
