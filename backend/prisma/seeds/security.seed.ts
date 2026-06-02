/**
 * 보안 센터 더미 — 위험 요소(SecurityRisk) + 로그인 세션(LoginSession).
 * 위험 4건의 심각도 가중(12+8+5+3)으로 보안 점수 72점이 나오도록 구성. 세션은 현재기기/미확인 포함.
 */
import type {
  SecurityRiskCategory,
  SecurityRiskSeverity,
  SessionDeviceType,
  SessionStatus,
} from '@prisma/client';
import type { SeedFn } from './helpers';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const ago = (ms: number): Date => new Date(Date.now() - ms);

type RiskSeed = {
  category: SecurityRiskCategory;
  severity: SecurityRiskSeverity;
  title: string;
  description: string;
  actionLabel: string;
};

const RISKS: RiskSeed[] = [
  { category: 'breach', severity: 'critical', title: '카카오뱅크 — 유출 의심 비밀번호', description: '다크웹 유출 DB에서 동일 비밀번호 발견', actionLabel: '변경' },
  { category: 'reuse', severity: 'danger', title: 'GitHub · 쿠팡 · 넷플릭스 — 비밀번호 재사용', description: '3개 계정이 같은 비밀번호 사용', actionLabel: '분리' },
  { category: 'weak', severity: 'warning', title: '카카오뱅크 — 8자 미만 비밀번호', description: 'bank1234! 강도 낮음', actionLabel: '강화' },
  { category: 'no2fa', severity: 'info', title: '쿠팡 외 4개 — 2FA 미설정', description: '2단계 인증으로 계정 보호 강화', actionLabel: '설정' },
];

type SessionSeed = {
  device: string;
  deviceType: SessionDeviceType;
  location: string;
  isCurrent: boolean;
  status: SessionStatus;
  lastActiveAt: Date;
};

const SESSIONS: SessionSeed[] = [
  { device: 'MacBook Pro · Chrome', deviceType: 'desktop', location: '서울 · 192.168.0.x', isCurrent: true, status: 'active', lastActiveAt: ago(2 * 60 * 1000) },
  { device: 'iPhone 15 · Safari', deviceType: 'mobile', location: '서울', isCurrent: false, status: 'active', lastActiveAt: ago(3 * HOUR) },
  { device: 'Windows · Edge', deviceType: 'unknown', location: '부산', isCurrent: false, status: 'unverified', lastActiveAt: ago(2 * DAY) },
];

// 한 사용자에게 보안 위험/세션 더미를 채운다 (기존 행 제거 후 재삽입 → idempotent)
export const seedSecurity: SeedFn = async (prisma, userId) => {
  await prisma.securityRisk.deleteMany({ where: { user_id: userId } });
  await prisma.loginSession.deleteMany({ where: { user_id: userId } });

  for (const r of RISKS) {
    await prisma.securityRisk.create({
      data: {
        user_id: userId,
        category: r.category,
        severity: r.severity,
        title: r.title,
        description: r.description,
        action_label: r.actionLabel,
      },
    });
  }

  for (const s of SESSIONS) {
    await prisma.loginSession.create({
      data: {
        user_id: userId,
        device: s.device,
        device_type: s.deviceType,
        location: s.location,
        is_current: s.isCurrent,
        status: s.status,
        last_active_at: s.lastActiveAt,
      },
    });
  }

  return RISKS.length + SESSIONS.length;
};
