/**
 * 투자 계좌(InvestmentAccount) + 종목(Investment) 더미.
 * ISA 계좌 하나에 ETF 3종목을 묶어 "계좌 예수금 공유" 시나리오를 보여주고, 나머지는 일반위탁 계좌에 둔다.
 * 국내/해외 주식·ETF·가상자산 섞고 손익(원금<>평가) 다양하게 구성.
 */
import type { InvestmentType } from '@prisma/client';
import { canEncrypt, d, enc, type SeedFn } from './helpers';

type AccountSeed = { name: string; cashBalance: number; accountNumber: string };

const ACCOUNTS: AccountSeed[] = [
  { name: 'ISA', cashBalance: 500000, accountNumber: '110-456-789012' },
  { name: '일반위탁', cashBalance: 501000, accountNumber: '110-123-456789' },
];

type InvestSeed = {
  account: string; // ACCOUNTS[].name 참조
  name: string;
  type: InvestmentType;
  symbol?: string; // 시세조회용 종목코드(국내)/티커(해외) — 가상자산은 미지원이라 비움
  quantity?: number; // 보유수량 — symbol과 짝지어 시세조회 시 평가금액 계산에 사용
  principal: number;
  currentValue: number;
  purchaseDate: string;
  memo: string | null;
};

const INVESTMENTS: InvestSeed[] = [
  // ISA 계좌 — ETF 3종목, 예수금 공유
  { account: 'ISA', name: 'S&P500 ETF', type: 'foreign_etf', symbol: 'SPY', quantity: 5.1, principal: 5000000, currentValue: 5830000, purchaseDate: '2024-03-02', memo: '매월 적립식' },
  // KRX 상장 국내 ETF(나스닥100 추종 상품일 뿐 거래소는 국내) — domestic_etf로 분류해야 네이버 API로 조회됨
  { account: 'ISA', name: 'TIGER 미국나스닥100', type: 'domestic_etf', symbol: '133690', quantity: 14, principal: 2500000, currentValue: 2890000, purchaseDate: '2025-01-15', memo: '연금저축 운용' },
  { account: 'ISA', name: 'KODEX 200', type: 'domestic_etf', symbol: '069500', quantity: 11, principal: 1500000, currentValue: 1455000, purchaseDate: '2025-06-02', memo: '코스피 추종' },
  // 일반위탁 계좌
  { account: '일반위탁', name: '삼성전자', type: 'domestic_stock', symbol: '005930', quantity: 10, principal: 3000000, currentValue: 3420000, purchaseDate: '2024-07-10', memo: '분할매수' },
  { account: '일반위탁', name: '카카오', type: 'domestic_stock', symbol: '035720', quantity: 55, principal: 2000000, currentValue: 1820000, purchaseDate: '2025-01-20', memo: '장기보유' },
  { account: '일반위탁', name: '비트코인', type: 'crypto', principal: 1500000, currentValue: 1777000, purchaseDate: '2025-05-11', memo: '소액 투자' },
  { account: '일반위탁', name: '애플', type: 'foreign_stock', symbol: 'AAPL', quantity: 6.4, principal: 2500000, currentValue: 2710000, purchaseDate: '2024-11-05', memo: null },
  { account: '일반위탁', name: 'TIGER 2차전지', type: 'domestic_etf', symbol: '305540', quantity: 94, principal: 1800000, currentValue: 1620000, purchaseDate: '2025-02-14', memo: '테마 ETF' },
  { account: '일반위탁', name: '이더리움', type: 'crypto', principal: 1000000, currentValue: 1340000, purchaseDate: '2025-03-30', memo: null },
  { account: '일반위탁', name: 'SK하이닉스', type: 'domestic_stock', symbol: '000660', quantity: 1, principal: 2200000, currentValue: 2640000, purchaseDate: '2025-04-08', memo: 'AI 반도체' },
  { account: '일반위탁', name: '엔비디아', type: 'foreign_stock', symbol: 'NVDA', quantity: 13.8, principal: 3000000, currentValue: 4180000, purchaseDate: '2024-09-12', memo: '장기 보유' },
  { account: '일반위탁', name: '테슬라', type: 'foreign_stock', symbol: 'TSLA', quantity: 2.7, principal: 1800000, currentValue: 1560000, purchaseDate: '2025-02-20', memo: '변동성 큼' },
  { account: '일반위탁', name: '리플', type: 'crypto', principal: 500000, currentValue: 720000, purchaseDate: '2025-05-25', memo: '소액 알트' },
  { account: '일반위탁', name: 'NAVER', type: 'domestic_stock', symbol: '035420', quantity: 8, principal: 1700000, currentValue: 1632000, purchaseDate: '2025-03-05', memo: null },
];

// 한 사용자에게 투자 계좌 + 종목 더미를 채운다 (idempotent)
export const seedInvestments: SeedFn = async (prisma, userId) => {
  await prisma.investment.deleteMany({ where: { user_id: userId } });
  await prisma.investmentAccount.deleteMany({ where: { user_id: userId } });

  const encryptAccounts = canEncrypt();
  if (!encryptAccounts) console.warn('  ⚠️ CREDENTIAL_SECRET 미설정 — 투자 계좌번호 더미는 건너뜀(계좌·종목은 계속 생성)');

  const accountId = new Map<string, number>();
  for (const a of ACCOUNTS) {
    const created = await prisma.investmentAccount.create({
      data: {
        user_id: userId,
        name: a.name,
        cash_balance: a.cashBalance,
        account_number_enc: encryptAccounts ? enc(a.accountNumber) : null,
      },
    });
    accountId.set(a.name, created.id);
  }

  for (const v of INVESTMENTS) {
    await prisma.investment.create({
      data: {
        user_id: userId,
        account_id: accountId.get(v.account)!,
        name: v.name,
        type: v.type,
        symbol: v.symbol,
        quantity: v.quantity,
        principal: v.principal,
        current_value: v.currentValue,
        purchase_date: d(v.purchaseDate),
        memo: v.memo,
      },
    });
  }
  return INVESTMENTS.length;
};
