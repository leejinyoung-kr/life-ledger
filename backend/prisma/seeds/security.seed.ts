/**
 * 보안 화면 더미 — 로그인 세션(LoginSession) + 최근 열람 기록(AccessLog). 세션은 현재기기/미확인 포함.
 */
import type { AccessAction, SessionDeviceType, SessionStatus } from '@prisma/client';
import type { SeedFn } from './helpers';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const ago = (ms: number): Date => new Date(Date.now() - ms);

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

// 최근 열람 기록 샘플 (created_at 은 트리거로 NOW() 고정 — 모두 최근으로 표시됨)
type LogSeed = { action: AccessAction; targetType: string; targetName: string };
const ACCESS_LOGS: LogSeed[] = [
  { action: 'cred_reveal', targetType: 'credential', targetName: 'GitHub' },
  { action: 'cred_totp', targetType: 'credential', targetName: 'Google' },
  { action: 'cred_backup', targetType: 'credential', targetName: 'Google' },
  { action: 'cred_reveal', targetType: 'credential', targetName: '카카오뱅크' },
  { action: 'cred_reveal', targetType: 'credential', targetName: '토스' },
  { action: 'cred_totp', targetType: 'credential', targetName: 'AWS' },
  { action: 'cred_totp', targetType: 'credential', targetName: 'Cloudflare' },
  { action: 'cred_backup', targetType: 'credential', targetName: 'GitLab' },
  { action: 'cred_reveal', targetType: 'credential', targetName: '네이버' },
];

// 한 사용자에게 세션 + 접근로그 더미를 채운다 (기존 행 제거 후 재삽입 → idempotent)
export const seedSecurity: SeedFn = async (prisma, userId) => {
  await prisma.loginSession.deleteMany({ where: { user_id: userId } });
  await prisma.accessLog.deleteMany({ where: { user_id: userId } });

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

  return SESSIONS.length + ACCESS_LOGS.length;
};
