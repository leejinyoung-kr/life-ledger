/**
 * 순자산 월별 스냅샷(NetWorthSnapshot) 더미.
 * 총자산 = 예적금(35.33M) + 투자(33.59M) 기준 지난 5개월 월말 값 (현금은 수입-지출-자산이동으로 별도 집계 — 스냅샷에는 미포함). 달은 실행일 기준으로 옮겨진다
 * 이번 달은 넣지 않는다 — 추이 차트의 이번 달 막대는 스냅샷이 아니라 지금 값이다
 * 부채(자산관리) 기능 제거 이후로는 total_debt를 항상 0으로 기록한다.
 */
import { ym, type SeedFn } from './helpers';

const SNAPSHOTS: { month: string; totalAssets: number }[] = [
  { month: '2026-01', totalAssets: 58500000 },
  { month: '2026-02', totalAssets: 61200000 },
  { month: '2026-03', totalAssets: 63800000 },
  { month: '2026-04', totalAssets: 65900000 },
  { month: '2026-05', totalAssets: 67600000 },
];

// 한 사용자에게 순자산 스냅샷 더미를 채운다 (기존 행 제거 후 재삽입 → idempotent)
export const seedNetWorthSnapshots: SeedFn = async (prisma, userId) => {
  await prisma.netWorthSnapshot.deleteMany({ where: { user_id: userId } });

  for (const s of SNAPSHOTS) {
    await prisma.netWorthSnapshot.create({
      data: {
        user_id: userId,
        month: ym(s.month),
        total_assets: s.totalAssets,
        total_debt: 0,
      },
    });
  }

  return SNAPSHOTS.length;
};
