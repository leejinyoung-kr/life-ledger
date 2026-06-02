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
  { group: 'ledger', tone: 'warning', title: '구독 예산 90% 초과', description: '이번 달 구독 지출이 예산(₩200,000)의 94%에 달했습니다. 미사용 구독 서비스 정리를 권장합니다.', source: '가계부', occurredAt: ago(1 * HOUR), read: false },
  { group: 'ledger', tone: 'success', title: '5월 정기 구독 결제 완료', description: '넷플릭스 외 6건의 정기 구독이 정상 결제됐습니다.', source: '구독 관리', occurredAt: ago(2 * DAY), read: false },
  { group: 'system', tone: 'success', title: '4월 AI 리포트 생성 완료', description: '2026년 4월 소비 분석 리포트가 준비됐습니다. 이번 달 식비가 27% 감소했습니다.', source: 'AI 리포트', occurredAt: ago(3 * DAY), read: false },
  { group: 'ledger', tone: 'info', title: '이번 달 순자산 증가', description: '순자산이 지난달 대비 ₩3,000,000 (2.1%) 증가했습니다.', source: '자산 종합', occurredAt: ago(4 * DAY), read: true },
  { group: 'ledger', tone: 'warning', title: '식비 예산 78% 도달', description: '이번 달 식비가 예산(₩400,000)의 78%에 도달했습니다.', source: '가계부', occurredAt: ago(5 * DAY), read: false },
  { group: 'system', tone: 'info', title: '계정 추가됨 — GitHub', description: '새 계정이 계정 보관함에 암호화되어 저장됐습니다.', source: '계정 보관함', occurredAt: ago(7 * DAY), read: true },
  { group: 'system', tone: 'info', title: '파일 업로드 완료 — 보험증권_2026.pdf', description: '파일이 Cloudflare R2에 안전하게 저장됐습니다.', source: '파일 보관함', occurredAt: ago(7 * DAY), read: true },
  { group: 'system', tone: 'warning', title: 'SSL 인증서 갱신 임박', description: '도메인 인증서가 14일 후 만료됩니다. 갱신이 필요합니다.', source: '시스템', occurredAt: ago(10 * DAY), read: true },
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
