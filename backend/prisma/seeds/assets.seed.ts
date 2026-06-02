/**
 * 자산/부채(Asset) + 순자산 스냅샷(NetWorthSnapshot) 더미.
 * 자산 유형(현금/예적금/투자/부동산)별로 채우고, debt 로 부채를 넣어 순자산을 구성한다.
 * 스냅샷 6개월은 추이 차트용 — 마지막 달(2026-06)은 현재 자산 합계와 일치하도록 맞췄다.
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

// 현금 26.9M + 예적금 37.0M + 투자 63.8M + 부동산 40.3M = 총자산 168.0M, 부채 25.0M → 순자산 143.0M
const ASSETS: AssetSeed[] = [
  { type: 'cash', name: '신한 입출금 계좌', amount: 15000000, interestRate: null, memo: '주거래' },
  { type: 'cash', name: '카카오뱅크 입출금', amount: 8000000, interestRate: null, memo: null },
  { type: 'cash', name: '토스 파킹통장', amount: 3900000, interestRate: 2.0, memo: '비상금' },

  { type: 'savings', name: '우리 청약저축', amount: 8400000, interestRate: 2.5, memo: '주택청약' },
  { type: 'savings', name: '신한 정기예금', amount: 8000000, interestRate: 3.8, memo: '목돈 예치' },
  { type: 'savings', name: 'KB 정기적금', amount: 14650000, interestRate: 3.6, memo: null },
  { type: 'savings', name: '카카오 26주 적금', amount: 1600000, interestRate: 5.0, memo: null },
  { type: 'savings', name: '토스 자유적금', amount: 1350000, interestRate: 4.2, memo: null },
  { type: 'savings', name: '케이뱅크 비상금예금', amount: 3000000, interestRate: 3.5, memo: null },

  { type: 'investment', name: '국내주식 포트폴리오', amount: 25000000, interestRate: null, memo: '삼성전자 외' },
  { type: 'investment', name: '해외주식 (미국)', amount: 20000000, interestRate: null, memo: 'S&P500 ETF 외' },
  { type: 'investment', name: '가상자산', amount: 18800000, interestRate: null, memo: 'BTC/ETH' },

  { type: 'realestate', name: '전세보증금', amount: 40300000, interestRate: null, memo: '거주 전세' },

  { type: 'debt', name: '전세자금대출', amount: 20000000, interestRate: 3.2, memo: '월 53,000 상환' },
  { type: 'debt', name: '신용카드 할부', amount: 3400000, interestRate: 0.0, memo: '월 340,000 상환' },
  { type: 'debt', name: '학자금대출', amount: 1600000, interestRate: 2.1, memo: '월 45,000 상환' },
];

// 순자산 6개월 추이 — total_assets / total_debt (순자산 = 차)
const SNAPSHOTS: { month: string; totalAssets: number; totalDebt: number }[] = [
  { month: '2026-01', totalAssets: 157000000, totalDebt: 25000000 },
  { month: '2026-02', totalAssets: 160000000, totalDebt: 25000000 },
  { month: '2026-03', totalAssets: 159000000, totalDebt: 25000000 },
  { month: '2026-04', totalAssets: 164000000, totalDebt: 25000000 },
  { month: '2026-05', totalAssets: 165000000, totalDebt: 25000000 },
  { month: '2026-06', totalAssets: 168000000, totalDebt: 25000000 },
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
