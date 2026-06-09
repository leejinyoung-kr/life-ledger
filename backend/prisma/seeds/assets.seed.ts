/**
 * 자산/부채(Asset) + 순자산 스냅샷(NetWorthSnapshot) 더미.
 * Asset 테이블에는 부동산·부채만 저장 (예적금 → Saving, 투자 → Investment, 현금 → Transaction).
 * 스냅샷 총자산 = 예적금(35.33M) + 투자(33.59M) + 부동산(40.3M) = 109.2M, 부채 27.0M → 순자산 82.2M
 * (현금은 수입-지출로 별도 집계 — 스냅샷에는 미포함)
 */
import type { AssetType } from '@prisma/client';
import type { SeedFn } from './helpers';

type AssetSeed = {
  type: AssetType;
  name: string;
  amount: number;
  interestRate: number | null;
  memo: string | null;
};

// 부동산 40.3M + 부채 27.0M (현금/예적금/투자는 각 전용 테이블에서 집계)
const ASSETS: AssetSeed[] = [
  { type: 'realestate', name: '전세보증금', amount: 40300000, interestRate: null, memo: '거주 전세' },

  { type: 'debt', name: '전세자금대출', amount: 20000000, interestRate: 3.2, memo: '월 53,000 상환' },
  { type: 'debt', name: '신용카드 할부', amount: 3400000, interestRate: 0.0, memo: '월 340,000 상환' },
  { type: 'debt', name: '학자금대출', amount: 1600000, interestRate: 2.1, memo: '월 45,000 상환' },
  { type: 'debt', name: '마이너스통장', amount: 2000000, interestRate: 5.4, memo: '한도 1천만 중 사용분' },
];

// 순자산 6개월 추이 (총자산 = 예적금+투자+부동산 기준, 현금 제외 / 6월 ≈ 실데이터 합계)
const SNAPSHOTS: { month: string; totalAssets: number; totalDebt: number }[] = [
  { month: '2026-01', totalAssets:  98500000, totalDebt: 28200000 },
  { month: '2026-02', totalAssets: 101200000, totalDebt: 27900000 },
  { month: '2026-03', totalAssets: 103800000, totalDebt: 27600000 },
  { month: '2026-04', totalAssets: 105900000, totalDebt: 27300000 },
  { month: '2026-05', totalAssets: 107600000, totalDebt: 27100000 },
  { month: '2026-06', totalAssets: 109200000, totalDebt: 27000000 },
];

// 한 사용자에게 자산/부채 + 스냅샷 더미를 채운다 (기존 행 제거 후 재삽입 → idempotent)
export const seedAssets: SeedFn = async (prisma, userId) => {
  await prisma.asset.deleteMany({ where: { user_id: userId } });
  await prisma.netWorthSnapshot.deleteMany({ where: { user_id: userId } });

  for (const a of ASSETS) {
    await prisma.asset.create({
      data: {
        user_id: userId,
        type: a.type,
        name: a.name,
        amount: a.amount,
        interest_rate: a.interestRate,
        memo: a.memo,
      },
    });
  }

  for (const s of SNAPSHOTS) {
    await prisma.netWorthSnapshot.create({
      data: {
        user_id: userId,
        month: s.month,
        total_assets: s.totalAssets,
        total_debt: s.totalDebt,
      },
    });
  }

  return ASSETS.length + SNAPSHOTS.length;
};
