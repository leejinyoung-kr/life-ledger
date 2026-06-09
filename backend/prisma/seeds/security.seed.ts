/**
 * 보안 센터 더미 — 위험 요소(SecurityRisk) + 로그인 세션(LoginSession).
 * 실제 보안 점수는 계정 보관함을 실시간 분석해 산출(재사용 3·취약 1·2FA미설정 9 → ~45점).
 * 아래 SecurityRisk 행은 표시용 샘플, 점수추이 스냅샷도 그 값에 맞춰 하락 추이로 구성. 세션은 현재기기/미확인 포함.
 */
import type {
  AccessAction,
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
  { category: 'no2fa', severity: 'info', title: '쿠팡 외 8개 — 2FA 미설정', description: '2단계 인증으로 계정 보호 강화', actionLabel: '설정' },
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
  { device: 'iPad Air · Safari', deviceType: 'mobile', location: '서울', isCurrent: false, status: 'active', lastActiveAt: ago(8 * HOUR) },
  { device: 'Galaxy Tab · Chrome', deviceType: 'mobile', location: '서울', isCurrent: false, status: 'active', lastActiveAt: ago(1 * DAY) },
  { device: 'Windows · Edge', deviceType: 'unknown', location: '부산', isCurrent: false, status: 'unverified', lastActiveAt: ago(2 * DAY) },
  { device: 'Linux · Firefox', deviceType: 'desktop', location: '인천', isCurrent: false, status: 'unverified', lastActiveAt: ago(5 * DAY) },
];

// 보안 점수 추이 30일 백필. date(KST) 기준 1일 1건.
// 계정이 늘며 2FA 미설정 누적 → 점수 60 → 45 점진 하락 (실시간 분석 점수와 대략 정합)
function scoreSnapshots(): { date: string; score: number; reuse: number; weak: number; no2fa: number }[] {
  const out: { date: string; score: number; reuse: number; weak: number; no2fa: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const date = new Date(Date.now() + 9 * HOUR - i * DAY).toISOString().slice(0, 10); // KST 날짜
    const no2fa = i > 20 ? 5 : i > 10 ? 7 : 9; // 계정 추가될수록 2FA 미설정 증가
    const reuse = 3; // Passw0rd! 재사용 3건 유지
    const weak = 1; // bank123 취약 1건
    const score = Math.max(0, 100 - (reuse * 8 + weak * 5 + no2fa * 3));
    out.push({ date, score, reuse, weak, no2fa });
  }
  return out;
}

// 최근 열람 기록 샘플 (created_at 은 트리거로 NOW() 고정 — 모두 최근으로 표시됨)
type LogSeed = { action: AccessAction; targetType: string; targetName: string };
const ACCESS_LOGS: LogSeed[] = [
  { action: 'cred_reveal', targetType: 'credential', targetName: 'GitHub' },
  { action: 'cred_totp', targetType: 'credential', targetName: 'Google' },
  { action: 'cred_backup', targetType: 'credential', targetName: 'Google' },
  { action: 'identity_reveal', targetType: 'identity', targetName: '여권' },
  { action: 'env_reveal', targetType: 'env', targetName: 'DATABASE_URL' },
  { action: 'cred_reveal', targetType: 'credential', targetName: '카카오뱅크' },
  { action: 'cred_reveal', targetType: 'credential', targetName: '토스' },
  { action: 'cred_totp', targetType: 'credential', targetName: 'AWS' },
  { action: 'cred_totp', targetType: 'credential', targetName: 'Cloudflare' },
  { action: 'cred_backup', targetType: 'credential', targetName: 'GitLab' },
  { action: 'env_reveal', targetType: 'env', targetName: 'B2_APP_KEY' },
  { action: 'env_reveal', targetType: 'env', targetName: 'OPENAI_API_KEY' },
  { action: 'identity_reveal', targetType: 'identity', targetName: '주민등록증' },
  { action: 'cred_reveal', targetType: 'credential', targetName: '네이버' },
];

// 한 사용자에게 보안 위험/세션 + 점수추이/접근로그 더미를 채운다 (기존 행 제거 후 재삽입 → idempotent)
export const seedSecurity: SeedFn = async (prisma, userId) => {
  await prisma.securityRisk.deleteMany({ where: { user_id: userId } });
  await prisma.loginSession.deleteMany({ where: { user_id: userId } });
  await prisma.securityScoreSnapshot.deleteMany({ where: { user_id: userId } });
  await prisma.accessLog.deleteMany({ where: { user_id: userId } });

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

  // 보안 점수 추이 (17a)
  const snaps = scoreSnapshots();
  await prisma.securityScoreSnapshot.createMany({
    data: snaps.map((s) => ({ user_id: userId, date: s.date, score: s.score, reuse: s.reuse, weak: s.weak, no2fa: s.no2fa })),
  });

  // 최근 열람 기록 (17a) — target_id 는 표시용 더미값
  await prisma.accessLog.createMany({
    data: ACCESS_LOGS.map((l, i) => ({
      user_id: userId,
      action: l.action,
      target_type: l.targetType,
      target_id: i + 1,
      target_name: l.targetName,
      ip: '192.168.0.10',
      user_agent: 'Mozilla/5.0 (Macintosh) Chrome/124',
    })),
  });

  return RISKS.length + SESSIONS.length + snaps.length + ACCESS_LOGS.length;
};
