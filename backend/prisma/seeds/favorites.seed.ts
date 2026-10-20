/**
 * 거래 즐겨찾기(TransactionFavorite) 더미.
 * 수입/지출 화면 위 즐겨찾기 줄 — 누르면 오늘 날짜로 추가 창이 채워진다. 자주 쓰는 지출 위주로.
 */
import type { TransactionType } from '@prisma/client';
import type { SeedFn } from './helpers';

// payMethod 는 코드 관리 pay_method code — 지출만 저장된다
type FavoriteSeed = { type: TransactionType; title: string; category: string; amount: number; payMethod: string; memo?: string };

const FAVORITES: FavoriteSeed[] = [
  { type: 'expense', title: '스타벅스', category: 'food_cafe', amount: 6500, payMethod: 'kakao_pay', memo: '아메리카노' },
  { type: 'expense', title: '점심', category: 'food_dining', amount: 10000, payMethod: 'shinhan_card' },
  { type: 'expense', title: '교통카드 충전', category: 'transport_transit', amount: 50000, payMethod: 'kakao_pay' },
  { type: 'expense', title: '이마트 장보기', category: 'food_grocery', amount: 70000, payMethod: 'shinhan_card' },
  { type: 'income', title: '중고거래 판매', category: 'income_side', amount: 30000, payMethod: '' },
];

// 한 사용자에게 즐겨찾기 더미를 채운다 (기존 행 제거 후 재삽입 → idempotent)
export const seedFavorites: SeedFn = async (prisma, userId) => {
  await prisma.transactionFavorite.deleteMany({ where: { user_id: userId } });

  await prisma.transactionFavorite.createMany({
    data: FAVORITES.map((f, i) => ({
      user_id: userId,
      type: f.type,
      title: f.title,
      category: f.category,
      amount: f.amount,
      // 결제수단은 지출에만 의미 — 수입은 빈값 (수입/지출 시드와 같은 규칙)
      pay_method: f.type === 'expense' ? f.payMethod : '',
      memo: f.memo ?? null,
      sort_order: i,
    })),
  });
  return FAVORITES.length;
};
