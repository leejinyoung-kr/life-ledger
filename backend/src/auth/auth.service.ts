import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service.js';

export interface GoogleUser {
  googleId: string;
  email: string;
  name: string;
  picture: string;
}

@Injectable()
export class AuthService {
  constructor(
    private jwtService: JwtService,
    private prisma: PrismaService,
  ) {}

  // Google 로그인 시 user upsert 후 JWT 발급
  async login(googleUser: GoogleUser): Promise<string> {
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

    return this.jwtService.sign({
      sub: user.id,
      googleId: user.google_id,
      email: user.email,
      name: user.name,
      picture: user.picture,
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
      this.prisma.category.deleteMany(w),
      this.prisma.user.delete({ where: { id: userId } }),
    ]);
    return { ok: true };
  }
}
