import { Injectable, NotFoundException } from '@nestjs/common';
import { LoginSession } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AccessLogService } from '../access-log/access-log.service';
import type { ClientInfo } from '@leejinyoung-kr/core-logging';

@Injectable()
export class SecurityService {
  constructor(
    private prisma: PrismaService,
    private accessLog: AccessLogService,
  ) {}

  private sessionDto(s: LoginSession) {
    return {
      id: s.id,
      device: s.device,
      deviceType: s.device_type,
      location: s.location,
      isCurrent: s.is_current,
      status: s.status,
      lastActiveAt: s.last_active_at.toISOString(),
    };
  }

  // 활성 로그인 세션 목록 (현재 기기 먼저, 최근활동순)
  async sessions(userId: number) {
    const rows = await this.prisma.loginSession.findMany({
      where: { user_id: userId, revoked_at: null },
      orderBy: [{ is_current: 'desc' }, { last_active_at: 'desc' }],
    });
    return rows.map((s) => this.sessionDto(s));
  }

  // 단일 세션 로그아웃/차단 (현재 기기는 불가) — 연결된 refresh 토큰도 함께 폐기
  async revokeSession(userId: number, id: number, client?: ClientInfo) {
    const session = await this.prisma.loginSession.findFirst({
      where: { id, user_id: userId, revoked_at: null },
    });
    if (!session) throw new NotFoundException('세션을 찾을 수 없습니다.');
    if (session.is_current) throw new NotFoundException('현재 기기는 로그아웃할 수 없습니다.');
    await this.prisma.$transaction([
      this.prisma.loginSession.update({ where: { id }, data: { revoked_at: new Date() } }),
      this.prisma.refreshToken.updateMany({
        where: { session_id: id, revoked_at: null },
        data: { revoked_at: new Date() },
      }),
    ]);
    await this.accessLog.log(userId, 'session_revoke', { type: 'security', id, name: session.device }, client);
    return { id };
  }

  // 현재 기기 제외 전체 로그아웃 — 연결된 refresh 토큰도 함께 폐기
  async revokeAll(userId: number, client?: ClientInfo) {
    const sessions = await this.prisma.loginSession.findMany({
      where: { user_id: userId, revoked_at: null, is_current: false },
      select: { id: true },
    });
    const ids = sessions.map((s) => s.id);
    await this.prisma.$transaction([
      this.prisma.loginSession.updateMany({ where: { id: { in: ids } }, data: { revoked_at: new Date() } }),
      this.prisma.refreshToken.updateMany({
        where: { session_id: { in: ids }, revoked_at: null },
        data: { revoked_at: new Date() },
      }),
    ]);
    await this.accessLog.log(userId, 'session_revoke', { type: 'security', id: userId, name: `all:${ids.length}` }, client);
    return { revoked: ids.length };
  }
}
