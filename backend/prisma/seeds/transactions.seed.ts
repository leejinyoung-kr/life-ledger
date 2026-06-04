/**
 * 수입/지출(Transaction) 더미.
 * 날짜·유형·카테고리·결제수단을 다양하게 구성한다. 데이터가 늘면 아래 배열만 추가.
 */
import type { TransactionType } from '@prisma/client';
import { d, type SeedFn } from './helpers';

type WeekendAdjust = 'none' | 'before' | 'after';

type TxSeed = {
  type: TransactionType;
  date: string;
  title: string;
  category: string;
  amount: number;
  payMethod: string;
  memo?: string;
  recurring?: boolean;
  weekendAdjust?: WeekendAdjust;
};

// 2026-01 ~ 2026-06 매월 반복되는 고정 거래 (급여/저축이동/구독)
function fixedRows(): TxSeed[] {
  const months = ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06'];
  const rows: TxSeed[] = [];
  for (const ym of months) {
    const mnum = Number(ym.slice(5));
    rows.push({ type: 'income',   date: `${ym}-25`, title: '월급',         category: 'salary',       amount: 3200000, payMethod: '계좌이체', memo: `${mnum}월 급여`, recurring: true, weekendAdjust: 'before' });
    rows.push({ type: 'transfer', date: `${ym}-30`, title: '청약저축 납입', category: 'transfer',     amount:  200000, payMethod: '계좌이체', memo: '잔액에서 제외',  recurring: true, weekendAdjust: 'none' });
    rows.push({ type: 'expense',  date: `${ym}-29`, title: '넷플릭스',      category: 'subscription', amount:   17000, payMethod: '신한카드', memo: '월정액',        recurring: true, weekendAdjust: 'none' });
  }
  return rows;
}

// 월별 변동 거래 — 금액·카테고리·결제수단 섞어서
const VARIABLE: TxSeed[] = [
  { type: 'expense', date: '2026-01-03', title: '이마트 장보기', category: 'food', amount: 84300, payMethod: '신한카드', memo: '주간 장보기' },
  { type: 'expense', date: '2026-01-12', title: '지하철 정기권', category: 'transport', amount: 55000, payMethod: '카카오페이' },
  { type: 'expense', date: '2026-01-18', title: '무신사 패딩', category: 'shopping', amount: 129000, payMethod: '신한카드', memo: '겨울 외투' },
  { type: 'income', date: '2026-01-22', title: '중고거래 판매', category: 'etc', amount: 45000, payMethod: '계좌이체', memo: '안 쓰는 키보드' },

  { type: 'expense', date: '2026-02-05', title: '스타벅스', category: 'food', amount: 6500, payMethod: '카카오페이', memo: '아메리카노' },
  { type: 'expense', date: '2026-02-14', title: '발렌타인 선물', category: 'shopping', amount: 38000, payMethod: '현금' },
  { type: 'expense', date: '2026-02-19', title: '택시', category: 'transport', amount: 12800, payMethod: '카카오페이', memo: '야근 귀가' },
  { type: 'expense', date: '2026-02-24', title: '병원 진료', category: 'etc', amount: 23000, payMethod: '신한카드', memo: '감기' },

  { type: 'expense', date: '2026-03-02', title: '쿠팡 생필품', category: 'shopping', amount: 47600, payMethod: '신한카드' },
  { type: 'expense', date: '2026-03-09', title: '점심 회식', category: 'food', amount: 32000, payMethod: '현금' },
  { type: 'expense', date: '2026-03-15', title: 'KTX 부산', category: 'transport', amount: 59800, payMethod: '신한카드', memo: '주말 여행' },
  { type: 'income', date: '2026-03-28', title: '카드 캐시백', category: 'etc', amount: 18500, payMethod: '계좌이체' },

  { type: 'expense', date: '2026-04-04', title: '올리브영', category: 'shopping', amount: 41200, payMethod: '카카오페이' },
  { type: 'expense', date: '2026-04-11', title: '배달의민족', category: 'food', amount: 24500, payMethod: '카카오페이', memo: '치킨' },
  { type: 'expense', date: '2026-04-17', title: '유튜브 프리미엄', category: 'subscription', amount: 14900, payMethod: '신한카드' },
  { type: 'expense', date: '2026-04-23', title: '주유', category: 'transport', amount: 70000, payMethod: '신한카드' },

  { type: 'expense', date: '2026-05-06', title: '어버이날 선물', category: 'shopping', amount: 150000, payMethod: '계좌이체', memo: '카네이션+상품권' },
  { type: 'expense', date: '2026-05-13', title: '마트 장보기', category: 'food', amount: 67800, payMethod: '신한카드' },
  { type: 'expense', date: '2026-05-20', title: '영화 2매', category: 'etc', amount: 28000, payMethod: '카카오페이' },
  { type: 'income', date: '2026-05-31', title: '분기 성과급', category: 'salary', amount: 500000, payMethod: '계좌이체', memo: '1분기 인센티브' },

  { type: 'expense', date: '2026-06-01', title: '스타벅스', category: 'food', amount: 6500, payMethod: '카카오페이', memo: '아메리카노' },
  { type: 'expense', date: '2026-06-02', title: '교통카드 충전', category: 'transport', amount: 30000, payMethod: '카카오페이' },
];

// 한 사용자에게 수입/지출 더미를 채운다 (기존 행 제거 후 재삽입 → idempotent)
export const seedTransactions: SeedFn = async (prisma, userId) => {
  await prisma.transaction.deleteMany({ where: { user_id: userId } });

  const rows = [...fixedRows(), ...VARIABLE];
  for (const t of rows) {
    await prisma.transaction.create({
      data: {
        user_id: userId,
        type: t.type,
        date: d(t.date),
        title: t.title,
        category: t.category,
        amount: t.amount,
        // 결제수단은 지출에만 의미 — 수입/자산이동은 빈값 저장
        pay_method: t.type === 'expense' ? t.payMethod : '',
        memo: t.memo ?? null,
        is_recurring: t.recurring ?? false,
        recurring_rule: t.recurring
          ? { cycle: 'monthly', day: Number(t.date.slice(8)), weekendAdjust: t.weekendAdjust ?? 'none' }
          : undefined,
      },
    });
  }
  return rows.length;
};
