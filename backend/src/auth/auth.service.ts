import { randomUUID } from 'node:crypto';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { PushService } from '../push/push.service.js';

export interface GoogleUser {
  googleId: string;
  email: string;
  name: string;
  picture: string;
}

// 로그인 클라이언트 정보 (기기 감지용)
export interface LoginClient {
  ip?: string;
  userAgent?: string;
}

// 토큰 수명 — Access 짧게(자주 갱신), Refresh 길게(쿠키 보관)
const ACCESS_TTL = '15m';
const REFRESH_TTL = '7d';
const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// User-Agent → 기기 표기/종류 추정 (간이)
function parseDevice(ua = ''): { device: string; type: 'desktop' | 'mobile' | 'unknown' } {
  if (!ua) return { device: '알 수 없는 기기', type: 'unknown' };
  const mobile = /Mobile|Android|iPhone|iPad/i.test(ua);
  const browser = /Edg/i.test(ua) ? 'Edge' : /Chrome/i.test(ua) ? 'Chrome' : /Firefox/i.test(ua) ? 'Firefox' : /Safari/i.test(ua) ? 'Safari' : 'Unknown';
  const os = /Windows/i.test(ua) ? 'Windows' : /Mac OS/i.test(ua) ? 'macOS' : /Android/i.test(ua) ? 'Android' : /iPhone|iPad/i.test(ua) ? 'iOS' : /Linux/i.test(ua) ? 'Linux' : '';
  return { device: `${os ? os + ' · ' : ''}${browser}`, type: mobile ? 'mobile' : 'desktop' };
}

@Injectable()
export class AuthService {
  constructor(
    private jwtService: JwtService,
    private prisma: PrismaService,
    private push: PushService,
  ) {}

  // 접근 토큰 — 사용자 정보 포함(JwtStrategy 가 검증)
  private signAccess(user: User): string {
    return this.jwtService.sign(
      {
        sub: user.id,
        googleId: user.google_id,
        email: user.email,
        name: user.name,
        picture: user.picture,
        type: 'access',
      },
      { expiresIn: ACCESS_TTL },
    );
  }

  // 갱신 토큰 — sub + jti(화이트리스트 식별자), httpOnly 쿠키로만 사용
  private signRefresh(userId: number, jti: string): string {
    return this.jwtService.sign({ sub: userId, jti, type: 'refresh' }, { expiresIn: REFRESH_TTL });
  }

  // Google 로그인 시 user upsert 후 access/refresh 토큰 발급. 클라이언트 정보가 있으면 세션 기록·신규 기기 감지
  async login(googleUser: GoogleUser, client?: LoginClient): Promise<{ access: string; refresh: string }> {
    const user = await this.prisma.user.upsert({
      where: { google_id: googleUser.googleId },
      update: {
        email: googleUser.email,
        name: googleUser.name,
        picture: googleUser.picture,
      },
      create: {
        google_id: googleUser.googleId,
        email: googleUser.email,
        name: googleUser.name,
        picture: googleUser.picture,
      },
    });

    const sessionId = client ? await this.recordLogin(user.id, client) : null;
    const jti = randomUUID();
    await this.prisma.refreshToken.create({
      data: { user_id: user.id, session_id: sessionId, jti, expires_at: new Date(Date.now() + REFRESH_TTL_MS) },
    });
    return { access: this.signAccess(user), refresh: this.signRefresh(user.id, jti) };
  }

  // 로그인 세션 기록 — 동일 기기/IP면 활동시각 갱신, 새 조합이면 세션 생성 + (첫 로그인 제외) 새 기기 알림. 발급될 refresh 토큰과 연결할 세션 id 반환
  private async recordLogin(userId: number, client: LoginClient): Promise<number> {
    const { device, type } = parseDevice(client.userAgent);
    const location = client.ip?.slice(0, 100) || '알 수 없음';

    const priorCount = await this.prisma.loginSession.count({ where: { user_id: userId, revoked_at: null } });
    const existing = await this.prisma.loginSession.findFirst({
      where: { user_id: userId, device, location, revoked_at: null },
    });

    // 이번 로그인 기기만 현재 기기로 표시
    await this.prisma.loginSession.updateMany({ where: { user_id: userId }, data: { is_current: false } });

    if (existing) {
      await this.prisma.loginSession.update({
        where: { id: existing.id },
        data: { is_current: true, last_active_at: new Date(), status: 'active' },
      });
      return existing.id;
    }

    const created = await this.prisma.loginSession.create({
      data: { user_id: userId, device, device_type: type, location, is_current: true, status: 'active' },
    });

    // 기존 세션이 있던 사용자에게만 새 기기 알림 (최초 로그인은 제외)
    if (priorCount > 0) {
      await this.prisma.notification.create({
        data: {
          user_id: userId,
          group: 'system',
          tone: 'warning',
          title: '새 기기에서 로그인',
          description: `${device} (${location}) 에서 로그인되었습니다. 본인이 아니라면 보안 센터에서 세션을 로그아웃하세요.`,
          source: '보안',
        },
      });
      // 새 기기 로그인은 보안 이벤트 → 웹 푸시도 발송 (VAPID 비활성 시 no-op)
      await this.push.sendToUser(userId, {
        title: '새 기기에서 로그인',
        body: `${device} (${location}) 에서 로그인되었습니다.`,
        url: '/security',
      });
    }

    return created.id;
  }

  // 갱신 토큰 검증 → 화이트리스트 확인 후 rotation(이전 jti 폐기 + 신규 access/refresh 발급)
  async refresh(refreshToken: string): Promise<{ access: string; refresh: string }> {
    if (!refreshToken) throw new UnauthorizedException('갱신 토큰이 없습니다.');
    let payload: { sub: number; jti?: string; type?: string };
    try {
      payload = this.jwtService.verify(refreshToken);
    } catch {
      throw new UnauthorizedException('갱신 토큰이 유효하지 않습니다.');
    }
    if (payload.type !== 'refresh' || !payload.jti) throw new UnauthorizedException('갱신 토큰이 아닙니다.');

    const stored = await this.prisma.refreshToken.findUnique({ where: { jti: payload.jti } });
    if (!stored || stored.revoked_at || stored.user_id !== payload.sub) {
      throw new UnauthorizedException('갱신 토큰이 유효하지 않습니다.');
    }

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) throw new UnauthorizedException('사용자를 찾을 수 없습니다.');

    const newJti = randomUUID();
    await this.prisma.$transaction([
      this.prisma.refreshToken.update({ where: { id: stored.id }, data: { revoked_at: new Date() } }),
      this.prisma.refreshToken.create({
        data: {
          user_id: user.id,
          session_id: stored.session_id,
          jti: newJti,
          expires_at: new Date(Date.now() + REFRESH_TTL_MS),
        },
      }),
    ]);

    return { access: this.signAccess(user), refresh: this.signRefresh(user.id, newJti) };
  }

  // 로그아웃 — refresh 토큰의 jti 를 화이트리스트에서 폐기 (서명 검증 실패해도 디코드되면 폐기 시도)
  async logout(refreshToken?: string): Promise<void> {
    if (!refreshToken) return;
    let payload: { jti?: string } | null;
    try {
      payload = this.jwtService.verify(refreshToken);
    } catch {
      payload = this.jwtService.decode(refreshToken) as { jti?: string } | null;
    }
    if (!payload?.jti) return;
    await this.prisma.refreshToken.updateMany({
      where: { jti: payload.jti, revoked_at: null },
      data: { revoked_at: new Date() },
    });
  }

  // 계정 영구 삭제 — 전 도메인 데이터 + 사용자 제거 (되돌릴 수 없음)
  async deleteAccount(userId: number): Promise<{ ok: true }> {
    const w = { where: { user_id: userId } };
    await this.prisma.$transaction([
      this.prisma.transaction.deleteMany(w),
      this.prisma.saving.deleteMany(w),
      this.prisma.investment.deleteMany(w),
      this.prisma.subscription.deleteMany(w),
      this.prisma.asset.deleteMany(w),
      this.prisma.netWorthSnapshot.deleteMany(w),
      this.prisma.userSettings.deleteMany(w),
      this.prisma.notification.deleteMany(w),
      this.prisma.task.deleteMany(w),
      this.prisma.goal.deleteMany(w),
      this.prisma.note.deleteMany(w),
      this.prisma.calendarEvent.deleteMany(w),
      this.prisma.securityRisk.deleteMany(w),
      this.prisma.loginSession.deleteMany(w),
      // category 는 전역 공용 — 특정 유저 삭제로 지우지 않음 (created_by 만 남고 데이터 보존)
      this.prisma.user.delete({ where: { id: userId } }),
    ]);
    return { ok: true };
  }
}
