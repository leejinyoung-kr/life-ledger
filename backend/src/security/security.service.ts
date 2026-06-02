import { Injectable, NotFoundException } from '@nestjs/common';
import { LoginSession, SecurityRisk, SecurityRiskSeverity } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

// 심각도별 점수 차감 가중치
const SEVERITY_WEIGHT: Record<SecurityRiskSeverity, number> = {
  critical: 12,
  danger: 8,
  warning: 5,
  info: 3,
};

@Injectable()
export class SecurityService {
  constructor(private prisma: PrismaService) {}

  private riskDto(r: SecurityRisk) {
    return {
      id: r.id,
      category: r.category,
      severity: r.severity,
      title: r.title,
      description: r.description,
      actionLabel: r.action_label,
    };
  }

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

  // 요약 — 보안 점수(미해결 위험 가중 차감) + 카테고리별 미해결 건수
  async summary(userId: number) {
    const risks = await this.prisma.securityRisk.findMany({
      where: { user_id: userId, resolved: false },
    });
    const deduction = risks.reduce((s, r) => s + SEVERITY_WEIGHT[r.severity], 0);
    const score = Math.max(0, Math.min(100, 100 - deduction));
    const label = score >= 80 ? '양호' : score >= 60 ? '보통' : '취약';

    const countOf = (cat: string) => risks.filter((r) => r.category === cat).length;

    return {
      score,
      scoreLabel: label,
      gainIfResolved: 100 - score,
      riskCount: risks.length,
      stats: {
        reuse: countOf('reuse'),
        weak: countOf('weak'),
        no2fa: countOf('no2fa'),
        breach: countOf('breach'),
      },
    };
  }

  // 미해결 위험 요소 목록 (심각도순)
  async risks(userId: number) {
    const order: SecurityRiskSeverity[] = ['critical', 'danger', 'warning', 'info'];
    const rows = await this.prisma.securityRisk.findMany({
      where: { user_id: userId, resolved: false },
    });
    rows.sort((a, b) => order.indexOf(a.severity) - order.indexOf(b.severity));
    return rows.map((r) => this.riskDto(r));
  }

  // 위험 요소 해결 처리
  async resolveRisk(userId: number, id: number) {
    const res = await this.prisma.securityRisk.updateMany({
      where: { id, user_id: userId, resolved: false },
      data: { resolved: true, resolved_at: new Date() },
    });
    if (res.count === 0) throw new NotFoundException('위험 요소를 찾을 수 없습니다.');
    return { id };
  }

  // 활성 로그인 세션 목록 (현재 기기 먼저, 최근활동순)
  async sessions(userId: number) {
    const rows = await this.prisma.loginSession.findMany({
      where: { user_id: userId, revoked_at: null },
      orderBy: [{ is_current: 'desc' }, { last_active_at: 'desc' }],
    });
    return rows.map((s) => this.sessionDto(s));
  }

  // 단일 세션 로그아웃/차단 (현재 기기는 불가)
  async revokeSession(userId: number, id: number) {
    const session = await this.prisma.loginSession.findFirst({
      where: { id, user_id: userId, revoked_at: null },
    });
    if (!session) throw new NotFoundException('세션을 찾을 수 없습니다.');
    if (session.is_current) throw new NotFoundException('현재 기기는 로그아웃할 수 없습니다.');
    await this.prisma.loginSession.update({ where: { id }, data: { revoked_at: new Date() } });
    return { id };
  }

  // 현재 기기 제외 전체 로그아웃
  async revokeAll(userId: number) {
    const res = await this.prisma.loginSession.updateMany({
      where: { user_id: userId, revoked_at: null, is_current: false },
      data: { revoked_at: new Date() },
    });
    return { revoked: res.count };
  }
}
