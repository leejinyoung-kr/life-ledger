/**
 * 예적금(Saving) 더미.
 * 은행·유형·금리·만기일을 다양하게. 만기 임박(D-30) 검증용으로 오늘 기준 가까운 만기 2건 포함.
 */
import type { SavingType } from '@prisma/client';
import { d, dAt, inDays, type SeedFn } from './helpers';

type SavingSeed = {
  bank: string;
  name: string;
  type: SavingType;
  interestRate: number;
  monthlyAmount: number;
  startDate: string;
  maturityDate: string | null;
  balance: number;
  memo: string | null;
  maturityInDays?: number; // 만기 임박 — 오늘부터 며칠 뒤 만기인지 (D-day 가 늘 보이게 날짜 대신 간격으로)
};

const SAVINGS: SavingSeed[] = [
  { bank: '우리은행', name: '청약저축', type: 'subscription', interestRate: 2.5, monthlyAmount: 200000, startDate: '2018-03-01', maturityDate: null, balance: 9200000, memo: '주택청약종합저축' },
  { bank: '카카오뱅크', name: '26주 적금', type: 'savings', interestRate: 5.0, monthlyAmount: 100000, startDate: '2026-01-06', maturityDate: null, balance: 1600000, memo: '만기 임박', maturityInDays: 9 },
  { bank: '신한은행', name: '정기예금', type: 'deposit', interestRate: 3.8, monthlyAmount: 0, startDate: '2025-12-01', maturityDate: '2026-12-01', balance: 8000000, memo: '목돈 예치' },
  { bank: '토스뱅크', name: '자유적금', type: 'savings', interestRate: 4.2, monthlyAmount: 150000, startDate: '2025-09-15', maturityDate: '2027-09-15', balance: 1350000, memo: null },
  { bank: '케이뱅크', name: '비상금 예금', type: 'deposit', interestRate: 3.5, monthlyAmount: 0, startDate: '2025-06-28', maturityDate: null, balance: 3000000, memo: '비상자금', maturityInDays: 24 },
  { bank: '국민은행', name: 'KB내맘대로적금', type: 'savings', interestRate: 4.5, monthlyAmount: 300000, startDate: '2025-11-01', maturityDate: '2026-11-01', balance: 2100000, memo: '여행 자금' },
  { bank: '하나은행', name: '하나 정기예금', type: 'deposit', interestRate: 3.6, monthlyAmount: 0, startDate: '2026-02-10', maturityDate: '2027-02-10', balance: 5000000, memo: '목돈 분산' },
  { bank: 'NH농협', name: '주택청약 부금', type: 'subscription', interestRate: 2.8, monthlyAmount: 100000, startDate: '2022-05-01', maturityDate: null, balance: 4600000, memo: '청약 가점용' },
  { bank: '카카오뱅크', name: '저금통', type: 'savings', interestRate: 2.0, monthlyAmount: 0, startDate: '2025-08-01', maturityDate: null, balance: 480000, memo: '잔돈 모으기' },
];

// 한 사용자에게 예적금 더미를 채운다 (idempotent)
export const seedSavings: SeedFn = async (prisma, userId) => {
  await prisma.saving.deleteMany({ where: { user_id: userId } });

  for (const s of SAVINGS) {
    await prisma.saving.create({
      data: {
        user_id: userId,
        bank: s.bank,
        name: s.name,
        type: s.type,
        interest_rate: s.interestRate,
        monthly_amount: s.monthlyAmount,
        start_date: d(s.startDate),
        maturity_date: s.maturityInDays != null ? dAt(inDays(s.maturityInDays)) : s.maturityDate ? d(s.maturityDate) : null,
        balance: s.balance,
        memo: s.memo,
      },
    });
  }
  return SAVINGS.length;
};
