/**
 * 순자산 월별 스냅샷(NetWorthSnapshot) 더미.
 * 지난 5개월 월말 값 = 예적금·투자(아래 표) + 그 달 말까지의 현금(수입 - 지출 - 자산이동, 시드된 거래로 계산). 달은 실행일 기준으로 옮겨진다
 * 현금을 빼고 넣으면 추이 차트의 이번 달(지금 값, 현금 포함) 막대만 훌쩍 뛰므로, 수입/지출 시드 뒤에 실행해 크론과 같은 방식으로 채운다
 * 이번 달은 넣지 않는다 — 추이 차트의 이번 달 막대는 스냅샷이 아니라 지금 값이다
 * 부채(자산관리) 기능 제거 이후로는 total_debt를 항상 0으로 기록한다.
 */
import type { PrismaClient } from '@prisma/client';
import { ym, type SeedFn } from './helpers';

// 예적금 + 투자 월말 합계 (현금 제외)
const SNAPSHOTS: { month: string; investedAssets: number }[] = [
  { month: '2026-01', investedAssets: 58500000 },
  { month: '2026-02', investedAssets: 61200000 },
  { month: '2026-03', investedAssets: 63800000 },
  { month: '2026-04', investedAssets: 65900000 },
  { month: '2026-05', investedAssets: 67600000 },
];

// 'YYYY-MM' 다음 달 1일 (UTC 자정) — 그 달 말까지의 거래를 고르는 상한
function firstDayOfMonthAfter(month: string): Date {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m, 1));
}

// 그 달 말까지의 누적 현금 — AssetService.cashTotalForSnapshot 과 같은 계산
async function cashUntil(prisma: PrismaClient, userId: number, month: string): Promise<number> {
  const rows = await prisma.transaction.groupBy({
    by: ['type'],
    where: { user_id: userId, deleted_at: null, date: { lt: firstDayOfMonthAfter(month) } },
    _sum: { amount: true },
  });
  const sumOf = (type: string) => rows.find((r) => r.type === type)?._sum.amount?.toNumber() ?? 0;
  return sumOf('income') - sumOf('expense') - sumOf('transfer');
}

// 한 사용자에게 순자산 스냅샷 더미를 채운다 (기존 행 제거 후 재삽입 → idempotent)
export const seedNetWorthSnapshots: SeedFn = async (prisma, userId) => {
  await prisma.netWorthSnapshot.deleteMany({ where: { user_id: userId } });

  for (const s of SNAPSHOTS) {
    const month = ym(s.month);
    const cash = await cashUntil(prisma, userId, month);
    await prisma.netWorthSnapshot.create({
      data: {
        user_id: userId,
        month,
        total_assets: s.investedAssets + cash,
        total_debt: 0,
        cash_total: cash,
      },
    });
  }

  return SNAPSHOTS.length;
};
