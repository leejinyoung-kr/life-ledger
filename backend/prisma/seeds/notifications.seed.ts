/**
 * 알림(Notification) 더미.
 * group(가계부/시스템)·tone(warning/success/info)·source 를 다양하게, 읽음/안읽음 섞어서.
 * occurred_at 은 현재 기준 상대시각(1시간/3일 전 등) — created_at 은 트리거가 NOW()로 덮으므로
 * 화면 표시는 occurred_at 을 쓴다.
 */
import type { NotiGroup, NotiTone } from '@prisma/client';
import type { SeedFn } from './helpers';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
// 현재에서 ms 만큼 과거 시각
const ago = (ms: number): Date => new Date(Date.now() - ms);

type NotiSeed = {
  group: NotiGroup;
  tone: NotiTone;
  title: string;
  description: string;
  source: string;
  occurredAt: Date;
  read: boolean;
};

const NOTIFICATIONS: NotiSeed[] = [
  // 문구는 앱이 실제로 보내는 알림(notification-cron · 로그인 · 파일 업로드)에 맞춘다
  { group: 'ledger', tone: 'warning', title: 'Disney+ 무료체험 종료 임박', description: '무료체험이 3일 후 종료되어 과금됩니다.', source: '구독', occurredAt: ago(1 * HOUR), read: false },
  { group: 'ledger', tone: 'info', title: '넷플릭스 결제 예정', description: '구독 결제일이 3일 남았습니다.', source: '구독', occurredAt: ago(5 * HOUR), read: false },
  { group: 'system', tone: 'warning', title: '새 기기에서 로그인', description: 'Windows · Edge (부산) 에서 로그인되었습니다. 본인이 아니라면 보안 화면에서 세션을 로그아웃하세요.', source: '보안', occurredAt: ago(2 * DAY), read: false },
  { group: 'ledger', tone: 'info', title: '26주 적금 만기 임박', description: '예적금 만기가 9일 남았습니다.', source: '예적금', occurredAt: ago(1 * DAY), read: false },
  { group: 'system', tone: 'warning', title: "'네이버' 비밀번호 교체 권장", description: '비밀번호를 변경한 지 210일이 지났습니다.', source: '계정 보관함', occurredAt: ago(3 * DAY), read: false },
  { group: 'system', tone: 'success', title: '보험증권_2026.pdf 업로드 완료', description: '파일 보관함에 업로드가 완료됐습니다.', source: '파일 보관함', occurredAt: ago(7 * DAY), read: true },
  { group: 'ledger', tone: 'info', title: 'ChatGPT Plus 결제 예정', description: '구독 결제일이 1일 남았습니다.', source: '구독', occurredAt: ago(9 * DAY), read: true },
  { group: 'system', tone: 'warning', title: "'AWS' 비밀번호 교체 권장", description: '비밀번호를 변경한 지 185일이 지났습니다.', source: '계정 보관함', occurredAt: ago(12 * DAY), read: true },
];

// 한 사용자에게 알림 더미를 채운다 (기존 행 제거 후 재삽입 → idempotent)
export const seedNotifications: SeedFn = async (prisma, userId) => {
  await prisma.notification.deleteMany({ where: { user_id: userId } });

  for (const n of NOTIFICATIONS) {
    await prisma.notification.create({
      data: {
        user_id: userId,
        group: n.group,
        tone: n.tone,
        title: n.title,
        description: n.description,
        source: n.source,
        occurred_at: n.occurredAt,
        // 읽은 알림은 발생 직후 읽은 것으로 (occurred + 30분)
        read_at: n.read ? new Date(n.occurredAt.getTime() + 30 * 60 * 1000) : null,
      },
    });
  }
  return NOTIFICATIONS.length;
};
