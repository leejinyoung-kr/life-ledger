/**
 * 시스템 로그(SystemLog) 더미.
 * 카테고리(recurring_buy·cron·asset·file·security·ai)와 레벨(info·warn·error)을
 * 고르게 섞어 최근 30일 범위로 구성.
 */
import { Prisma } from '@prisma/client';
import type { SeedFn } from './helpers';

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
    message: 'AAPL 반복매수 2026-06 회차 처리 완료',
    metadata: { investmentId: 3, symbol: 'AAPL', type: 'us_stock', period: '2026-06', quantity: '0.052381', amountKrw: '95200' },
    created_at: daysAgo(3, 23, 1),
  },
  {
    user_id: userId, level: 'info', category: 'recurring_buy',
    message: 'TIGER 미국S&P500 반복매수 2026-06 회차 처리 완료',
    metadata: { investmentId: 2, symbol: '360750', type: 'etf', period: '2026-06', quantity: '2.000000', amountKrw: '29800' },
    created_at: daysAgo(3, 9, 1),
  },
  {
    user_id: userId, level: 'warn', category: 'recurring_buy',
    message: 'TSLA 시세 조회 실패 — 다음 배치에 재시도',
    metadata: { investmentId: 4, symbol: 'TSLA', type: 'us_stock', period: '2026-06', error: 'Rate limit exceeded (429)' },
    created_at: daysAgo(5, 23, 2),
  },
  {
    user_id: userId, level: 'info', category: 'recurring_buy',
    message: 'TSLA 반복매수 2026-06 회차 처리 완료',
    metadata: { investmentId: 4, symbol: 'TSLA', type: 'us_stock', period: '2026-06', quantity: '0.038012', amountKrw: '132400' },
    created_at: daysAgo(4, 23, 1),
  },
  {
    user_id: userId, level: 'warn', category: 'recurring_buy',
    message: 'AAPL 반복매수 예수금 부족 — 충전 후 재시도',
    metadata: { investmentId: 3, symbol: 'AAPL', type: 'us_stock', period: '2026-05', required: '182.3400', currency: 'USD' },
    created_at: daysAgo(10, 23, 1),
  },
  {
    user_id: userId, level: 'error', category: 'recurring_buy',
    message: 'TIGER 미국S&P500 반복매수 DB 처리 충돌 — 다음 배치에 재시도',
    metadata: { investmentId: 2, symbol: '360750', type: 'etf', period: '2026-05', error: 'Deadlock found when trying to get lock' },
    created_at: daysAgo(15, 9, 2),
  },
  {
    user_id: userId, level: 'info', category: 'recurring_buy',
    message: 'TIGER 미국S&P500 반복매수 2026-05 회차 처리 완료',
    metadata: { investmentId: 2, symbol: '360750', type: 'etf', period: '2026-05', quantity: '2.000000', amountKrw: '29200' },
    created_at: daysAgo(14, 9, 1),
  },

  // ── recurring_tx ──────────────────────────────────────────────────────────
  {
    user_id: userId, level: 'info', category: 'recurring_tx',
    message: '반복거래 \'월세\' 2026-07 회차 생성',
    metadata: { transactionId: 12, title: '월세', period: '2026-07', amount: 650000 },
    created_at: daysAgo(3, 9, 0),
  },
  {
    user_id: userId, level: 'info', category: 'recurring_tx',
    message: '반복거래 \'넷플릭스\' 2026-07 회차 생성',
    metadata: { transactionId: 18, title: '넷플릭스', period: '2026-07', amount: 17000 },
    created_at: daysAgo(3, 9, 0),
  },
  {
    user_id: userId, level: 'warn', category: 'recurring_tx',
    message: '반복거래 \'급여\' 중복 회차 건너뜀',
    metadata: { transactionId: 5, title: '급여', period: '2026-06', reason: 'already_exists' },
    created_at: daysAgo(6, 9, 0),
  },

  // ── asset ─────────────────────────────────────────────────────────────────
  {
    user_id: userId, level: 'info', category: 'asset',
    message: '자산 스냅샷 저장 완료',
    metadata: { totalKrw: 42380000, itemCount: 5 },
    created_at: daysAgo(1, 0, 5),
  },
  {
    user_id: userId, level: 'warn', category: 'asset',
    message: '자산 시세 조회 실패 — 비트코인 가격 API 응답 없음',
    metadata: { assetId: 3, name: '비트코인', error: 'Request timeout' },
    created_at: daysAgo(7, 0, 3),
  },

  // ── security ──────────────────────────────────────────────────────────────
  {
    user_id: userId, level: 'info', category: 'security',
    message: '보안 점수 스냅샷 저장 완료',
    metadata: { score: 82, reuse: 1, weak: 0, no2fa: 1 },
    created_at: daysAgo(1, 3, 10),
  },
  {
    user_id: userId, level: 'warn', category: 'security',
    message: '비밀번호 재사용 계정 감지',
    metadata: { credentialId: 7, name: '네이버', reusedWith: ['다음'] },
    created_at: daysAgo(8, 3, 11),
  },

  // ── file ──────────────────────────────────────────────────────────────────
  {
    user_id: userId, level: 'info', category: 'file',
    message: '거래 내역 CSV 내보내기 완료',
    metadata: { rows: 134, sizeKb: 28 },
    created_at: daysAgo(4, 14, 22),
  },
  {
    user_id: userId, level: 'error', category: 'file',
    message: '파일 업로드 실패 — 지원하지 않는 형식',
    metadata: { filename: 'report.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', error: 'Unsupported file type' },
    created_at: daysAgo(12, 11, 5),
  },

  // ── ai ────────────────────────────────────────────────────────────────────
  {
    user_id: userId, level: 'info', category: 'ai',
    message: '월간 AI 리포트 생성 완료',
    metadata: { month: '2026-06', tokensUsed: 2148, durationMs: 4320 },
    created_at: daysAgo(3, 2, 0),
  },
  {
    user_id: userId, level: 'error', category: 'ai',
    message: 'AI 리포트 생성 실패 — API 한도 초과',
    metadata: { month: '2026-05', error: 'insufficient_quota', retryAfter: '2026-06-01T00:00:00Z' },
    created_at: daysAgo(20, 2, 1),
  },
  {
    user_id: userId, level: 'info', category: 'ai',
    message: '월간 AI 리포트 생성 완료',
    metadata: { month: '2026-05', tokensUsed: 1893, durationMs: 3870 },
    created_at: daysAgo(17, 2, 0),
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
