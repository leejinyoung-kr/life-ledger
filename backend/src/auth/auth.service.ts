import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';

export interface GoogleUser {
  googleId: string;
  email: string;
  name: string;
  picture: string;
}

// 토큰 수명 — Access 짧게(자주 갱신), Refresh 길게(쿠키 보관)
const ACCESS_TTL = '15m';
const REFRESH_TTL = '7d';

@Injectable()
export class AuthService {
  constructor(
    private jwtService: JwtService,
    private prisma: PrismaService,
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

  // 갱신 토큰 — 최소 payload(sub만), httpOnly 쿠키로만 사용
  private signRefresh(userId: number): string {
    return this.jwtService.sign({ sub: userId, type: 'refresh' }, { expiresIn: REFRESH_TTL });
  }

  // Google 로그인 시 user upsert 후 access/refresh 토큰 발급
  async login(googleUser: GoogleUser): Promise<{ access: string; refresh: string }> {
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

    return { access: this.signAccess(user), refresh: this.signRefresh(user.id) };
  }

  // 갱신 토큰 검증 → 새 access 발급 (type=refresh 만 허용, 사용자 존재 확인)
  async refresh(refreshToken: string): Promise<string> {
    if (!refreshToken) throw new UnauthorizedException('갱신 토큰이 없습니다.');
    let payload: { sub: number; type?: string };
    try {
      payload = this.jwtService.verify(refreshToken);
    } catch {
      throw new UnauthorizedException('갱신 토큰이 유효하지 않습니다.');
    }
    if (payload.type !== 'refresh') throw new UnauthorizedException('갱신 토큰이 아닙니다.');
    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) throw new UnauthorizedException('사용자를 찾을 수 없습니다.');
    return this.signAccess(user);
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
      this.prisma.category.deleteMany(w),
      this.prisma.user.delete({ where: { id: userId } }),
    ]);
    return { ok: true };
  }
}
