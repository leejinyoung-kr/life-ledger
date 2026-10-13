/**
 * 시스템 로그(SystemLog) 더미.
 * 카테고리(cron·recurring_buy·recurring_tx·asset·notification·file)와 레벨(info·warn·error)을
 * 고르게 섞어 최근 30일 범위로 구성. 메시지는 앱이 실제로 남기는 문구에 맞춘다.
 */
import { Prisma } from '@prisma/client';
import { ym, type SeedFn } from './helpers';

const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (n: number, h = 0, m = 0): Date => {
  const d = new Date(Date.now() - n * DAY);
  d.setHours(h, m, 0, 0);
  return d;
};

type LogSeed = {
  user_id?: number;
  level: 'info' | 'warn' | 'error';
  category: string;
  message: string;
  metadata?: Record<string, unknown>;
  created_at: Date;
};

const LOGS = (userId: number): LogSeed[] => [
  // ── cron ─────────────────────────────────────────────────────────────────
  {
    level: 'info', category: 'cron',
    message: '반복거래/반복매수(국내) 일괄 처리 완료 (사용자 1명)',
    metadata: { total: 1, failed: 0 },
    created_at: daysAgo(0, 9, 0),
  },
  {
    level: 'info', category: 'cron',
    message: '반복매수(해외) 일괄 처리 완료 (사용자 1명)',
    metadata: { total: 1, failed: 0 },
    created_at: daysAgo(0, 23, 0),
  },
  {
    level: 'info', category: 'cron',
    message: '반복거래/반복매수(국내) 일괄 처리 완료 (사용자 1명)',
    metadata: { total: 1, failed: 0 },
    created_at: daysAgo(1, 9, 0),
  },
  {
    user_id: userId, level: 'error', category: 'cron',
    message: '반복매수(해외) 처리 실패',
    metadata: { error: 'Connection timeout after 5000ms' },
    created_at: daysAgo(2, 23, 3),
  },
  {
    level: 'info', category: 'cron',
    message: '반복거래/반복매수(국내) 일괄 처리 완료 (사용자 1명)',
    metadata: { total: 1, failed: 0 },
    created_at: daysAgo(3, 9, 0),
  },

  // ── recurring_buy ─────────────────────────────────────────────────────────
  {
    user_id: userId, level: 'info', category: 'recurring_buy',
    message: `AAPL 반복매수 ${ym('2026-06')} 회차 처리 완료`,
    metadata: { investmentId: 3, symbol: 'AAPL', type: 'us_stock', period: ym('2026-06'), quantity: '0.052381', amountKrw: '95200' },
    created_at: daysAgo(3, 23, 1),
  },
  {
    user_id: userId, level: 'info', category: 'recurring_buy',
    message: `TIGER 미국S&P500 반복매수 ${ym('2026-06')} 회차 처리 완료`,
    metadata: { investmentId: 2, symbol: '360750', type: 'etf', period: ym('2026-06'), quantity: '2.000000', amountKrw: '29800' },
    created_at: daysAgo(3, 9, 1),
  },
  {
    user_id: userId, level: 'warn', category: 'recurring_buy',
    message: 'TSLA 시세 조회 실패 — 다음 배치에 재시도',
    metadata: { investmentId: 4, symbol: 'TSLA', type: 'us_stock', period: ym('2026-06'), error: 'Rate limit exceeded (429)' },
    created_at: daysAgo(5, 23, 2),
  },
  {
    user_id: userId, level: 'info', category: 'recurring_buy',
    message: `TSLA 반복매수 ${ym('2026-06')} 회차 처리 완료`,
    metadata: { investmentId: 4, symbol: 'TSLA', type: 'us_stock', period: ym('2026-06'), quantity: '0.038012', amountKrw: '132400' },
    created_at: daysAgo(4, 23, 1),
  },
  {
    user_id: userId, level: 'warn', category: 'recurring_buy',
    message: 'AAPL 반복매수 예수금 부족 — 충전 후 재시도',
    metadata: { investmentId: 3, symbol: 'AAPL', type: 'us_stock', period: ym('2026-05'), required: '182.3400', currency: 'USD' },
    created_at: daysAgo(10, 23, 1),
  },
  {
    user_id: userId, level: 'error', category: 'recurring_buy',
    message: 'TIGER 미국S&P500 반복매수 DB 처리 충돌 — 다음 배치에 재시도',
    metadata: { investmentId: 2, symbol: '360750', type: 'etf', period: ym('2026-05'), error: 'Deadlock found when trying to get lock' },
    created_at: daysAgo(15, 9, 2),
  },
  {
    user_id: userId, level: 'info', category: 'recurring_buy',
    message: `TIGER 미국S&P500 반복매수 ${ym('2026-05')} 회차 처리 완료`,
    metadata: { investmentId: 2, symbol: '360750', type: 'etf', period: ym('2026-05'), quantity: '2.000000', amountKrw: '29200' },
    created_at: daysAgo(14, 9, 1),
  },

  // ── recurring_tx ──────────────────────────────────────────────────────────
  {
    user_id: userId, level: 'info', category: 'recurring_tx',
    message: `반복거래 \'월세\' ${ym('2026-07')} 회차 생성`,
    metadata: { transactionId: 12, title: '월세', period: ym('2026-07'), amount: 650000 },
    created_at: daysAgo(3, 9, 0),
  },
  {
    user_id: userId, level: 'info', category: 'recurring_tx',
    message: `반복거래 \'넷플릭스\' ${ym('2026-07')} 회차 생성`,
    metadata: { transactionId: 18, title: '넷플릭스', period: ym('2026-07'), amount: 17000 },
    created_at: daysAgo(3, 9, 0),
  },
  {
    user_id: userId, level: 'warn', category: 'recurring_tx',
    message: '반복거래 \'급여\' 중복 회차 건너뜀',
    metadata: { transactionId: 5, title: '급여', period: ym('2026-06'), reason: 'already_exists' },
    created_at: daysAgo(6, 9, 0),
  },

  // ── asset ─────────────────────────────────────────────────────────────────
  {
    level: 'info', category: 'asset',
    message: `순자산 스냅샷 1건 저장 (${ym('2026-06')})`,
    metadata: { month: ym('2026-06'), total: 1, ok: 1 },
    created_at: daysAgo(1, 0, 5),
  },
  {
    user_id: userId, level: 'warn', category: 'asset',
    message: '달러 환율 조회 실패 — 달러 자산 0원 처리',
    metadata: { error: 'Request timeout', usdAmount: 1240.5 },
    created_at: daysAgo(7, 0, 3),
  },

  // ── notification ──────────────────────────────────────────────────────────
  {
    level: 'error', category: 'notification',
    message: '알림 발송 실패: push',
    metadata: { outboxId: 41, attempts: 5, error: 'push subscription has unsubscribed or expired (410)' },
    created_at: daysAgo(8, 3, 11),
  },

  // ── file ──────────────────────────────────────────────────────────────────
  {
    user_id: userId, level: 'error', category: 'file',
    message: 'ZIP 다운로드 실패',
    metadata: { error: 'Client aborted the request', files: 23 },
    created_at: daysAgo(12, 11, 5),
  },

];

export const seedSystemLogs: SeedFn = async (prisma, userId) => {
  await prisma.systemLog.deleteMany({});
  const rows = LOGS(userId).map((log) => ({
    user_id: log.user_id ?? null,
    level: log.level,
    category: log.category,
    message: log.message,
    metadata: log.metadata as unknown as Prisma.InputJsonValue ?? undefined,
    created_at: log.created_at,
  }));
  await prisma.systemLog.createMany({ data: rows });
  return rows.length;
};
