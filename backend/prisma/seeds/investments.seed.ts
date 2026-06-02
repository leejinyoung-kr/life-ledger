/**
 * 투자(Investment) 더미.
 * 국내/해외 주식·ETF·가상자산 섞고 손익(원금<>평가) 다양하게 구성.
 */
import type { InvestmentType } from '@prisma/client';
import { d, type SeedFn } from './helpers';

type InvestSeed = {
  name: string;
  type: InvestmentType;
  principal: number;
  currentValue: number;
  purchaseDate: string;
  memo: string | null;
};

const INVESTMENTS: InvestSeed[] = [
  { name: '삼성전자', type: 'domestic_stock', principal: 3000000, currentValue: 3420000, purchaseDate: '2024-07-10', memo: '분할매수' },
  { name: 'S&P500 ETF', type: 'foreign_etf', principal: 5000000, currentValue: 5830000, purchaseDate: '2024-03-02', memo: '매월 적립식' },
  { name: '카카오', type: 'domestic_stock', principal: 2000000, currentValue: 1820000, purchaseDate: '2025-01-20', memo: '장기보유' },
  { name: '비트코인', type: 'crypto', principal: 1500000, currentValue: 1777000, purchaseDate: '2025-05-11', memo: '소액 투자' },
  { name: '애플', type: 'foreign_stock', principal: 2500000, currentValue: 2710000, purchaseDate: '2024-11-05', memo: null },
  { name: 'TIGER 2차전지', type: 'domestic_etf', principal: 1800000, currentValue: 1620000, purchaseDate: '2025-02-14', memo: '테마 ETF' },
  { name: '이더리움', type: 'crypto', principal: 1000000, currentValue: 1340000, purchaseDate: '2025-03-30', memo: null },
];

// 한 사용자에게 투자 더미를 채운다 (idempotent)
export const seedInvestments: SeedFn = async (prisma, userId) => {
  await prisma.investment.deleteMany({ where: { user_id: userId } });

  for (const v of INVESTMENTS) {
    await prisma.investment.create({
      data: {
        user_id: userId,
        name: v.name,
        type: v.type,
        principal: v.principal,
        current_value: v.currentValue,
        purchase_date: d(v.purchaseDate),
        memo: v.memo,
      },
    });
  }
  return INVESTMENTS.length;
};
