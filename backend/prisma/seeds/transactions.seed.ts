/**
 * 수입/지출(Transaction) 더미.
 * 날짜·유형·카테고리·결제수단을 다양하게 구성한다. 데이터가 늘면 아래 배열만 추가.
 * 6개월 분량 — 실사용처럼 월별 20~30건 내외. 2026-01 ~ 06 으로 적었고, 실행하면 이번 달까지의 6개월로 옮겨진다(helpers 의 ds).
 */
import type { TransactionType, TransferTarget } from '@prisma/client';
import { dAt, ds, dsPlus, todayStr, type SeedFn } from './helpers';

type WeekendAdjust = 'none' | 'before' | 'after';

type TxSeed = {
  type: TransactionType;
  date: string;
  title: string;
  category: string;
  amount: number;
  payMethod: string; // 코드 관리 pay_method code — 지출만 저장된다
  memo?: string;
  recurring?: boolean;
  weekendAdjust?: WeekendAdjust;
  // 자산이동(transfer) 누적 대상 — 이름으로 지정, 시드 실행 시 해당 도메인 테이블에서 id를 조회해 연동(예적금/투자는 미리 시드되어 있어야 함)
  target?: { type: TransferTarget; name: string };
};

// 반복 거래 템플릿 (첫 달 날짜로 적는다 — 시드가 오늘까지의 회차를 매월 같이 넣고, 그 뒤는 예약 작업이 이어 만든다)
function fixedRows(): TxSeed[] {
  return [
    { type: 'income',   date: '2026-01-25', title: '월급',          category: 'income_salary',          amount: 3200000, payMethod: 'bank_transfer', memo: '월 급여',       recurring: true, weekendAdjust: 'before' },
    // 자산이동 — 예적금/투자로 자동 누적되는 거래(target). 시드 시 이름으로 해당 행을 조회해 연동
    { type: 'transfer', date: '2026-01-30', title: '청약저축 납입',  category: 'transfer_move',          amount:  200000, payMethod: 'bank_transfer', memo: '잔액에서 자동 누적', recurring: true, weekendAdjust: 'none', target: { type: 'saving', name: '청약저축' } },
    { type: 'transfer', date: '2026-01-20', title: 'ISA 예수금 적립', category: 'transfer_move',        amount:  200000, payMethod: 'bank_transfer', memo: '계좌 예수금으로 자동 누적', recurring: true, weekendAdjust: 'none', target: { type: 'investment', name: 'ISA' } },
    { type: 'expense',  date: '2026-01-29', title: '넷플릭스',       category: 'insurance_subscription', amount:   17000, payMethod: 'shinhan_card', memo: '월정액',        recurring: true, weekendAdjust: 'none' },
    { type: 'expense',  date: '2026-01-15', title: '휴대폰 요금',    category: 'insurance_telecom',      amount:   55000, payMethod: 'shinhan_card', memo: 'SKT 5G',        recurring: true, weekendAdjust: 'none' },
    { type: 'expense',  date: '2026-01-05', title: '실손보험료',     category: 'insurance_premium',      amount:   42000, payMethod: 'bank_transfer', memo: '월 보험료',     recurring: true, weekendAdjust: 'none' },
    { type: 'expense',  date: '2026-01-27', title: '전세자금대출 이자', category: 'etc_interest',         amount:   53000, payMethod: 'bank_transfer', memo: '대출 이자',     recurring: true, weekendAdjust: 'none' },
    { type: 'expense',  date: '2026-01-10', title: '헬스장 회비',    category: 'leisure_exercise',       amount:   45000, payMethod: 'shinhan_card', memo: '월 회원권',     recurring: true, weekendAdjust: 'none' },
  ];
}

// 월별 변동 거래 — 금액·카테고리·결제수단 섞어서. 식비/교통/쇼핑은 빈번, 큰 지출은 가끔.
const VARIABLE: TxSeed[] = [
  // ── 2026-01 ────────────────────────────────────────────────
  { type: 'expense', date: '2026-01-03', title: '이마트 장보기',    category: 'food_grocery',   amount:  84300, payMethod: 'shinhan_card', memo: '주간 장보기' },
  { type: 'expense', date: '2026-01-04', title: '스타벅스',        category: 'food_cafe',      amount:   6500, payMethod: 'kakao_pay' },
  { type: 'expense', date: '2026-01-06', title: '점심 김밥천국',    category: 'food_dining',    amount:   9000, payMethod: 'cash' },
  { type: 'expense', date: '2026-01-08', title: '교통카드 충전',    category: 'transport_transit', amount: 50000, payMethod: 'kakao_pay' },
  { type: 'expense', date: '2026-01-10', title: '배달의민족',      category: 'food_dining',    amount:  23400, payMethod: 'kakao_pay', memo: '치킨' },
  { type: 'expense', date: '2026-01-12', title: '올리브영',        category: 'beauty_cosmetic', amount: 38200, payMethod: 'naver_pay' },
  { type: 'expense', date: '2026-01-14', title: '쿠팡 생필품',      category: 'living_daily',   amount:  31500, payMethod: 'shinhan_card' },
  { type: 'expense', date: '2026-01-16', title: '병원 진료',        category: 'health_hospital', amount: 12000, payMethod: 'shinhan_card', memo: '감기' },
  { type: 'expense', date: '2026-01-16', title: '약국',           category: 'health_pharmacy', amount:  8400, payMethod: 'cash' },
  { type: 'expense', date: '2026-01-18', title: '무신사 패딩',      category: 'beauty_clothing', amount: 129000, payMethod: 'shinhan_card', memo: '외투' },
  { type: 'expense', date: '2026-01-20', title: '주말 외식',        category: 'food_dining',    amount:  46000, payMethod: 'hyundai_card', memo: '삼겹살' },
  { type: 'income',  date: '2026-01-22', title: '중고거래 판매',    category: 'income_side',    amount:  45000, payMethod: 'bank_transfer', memo: '안 쓰는 키보드' },
  { type: 'expense', date: '2026-01-24', title: 'CGV 영화',        category: 'leisure_culture', amount: 28000, payMethod: 'kakao_pay', memo: '2매' },
  { type: 'expense', date: '2026-01-26', title: '이마트 장보기',    category: 'food_grocery',   amount:  62700, payMethod: 'shinhan_card' },
  { type: 'expense', date: '2026-01-28', title: '교보문고',        category: 'selfdev_book',   amount:  19800, payMethod: 'naver_pay', memo: '기술서적' },

  // ── 2026-02 ────────────────────────────────────────────────
  { type: 'expense', date: '2026-02-02', title: '이마트 장보기',    category: 'food_grocery',   amount:  71200, payMethod: 'shinhan_card' },
  { type: 'expense', date: '2026-02-05', title: '스타벅스',        category: 'food_cafe',      amount:   6500, payMethod: 'kakao_pay', memo: '아메리카노' },
  { type: 'expense', date: '2026-02-07', title: '쿠팡 생필품',      category: 'living_daily',   amount:  28900, payMethod: 'shinhan_card' },
  { type: 'expense', date: '2026-02-09', title: '점심 회식',        category: 'food_dining',    amount:  32000, payMethod: 'cash' },
  { type: 'expense', date: '2026-02-11', title: '지하철 정기권',    category: 'transport_transit', amount: 55000, payMethod: 'kakao_pay' },
  { type: 'expense', date: '2026-02-14', title: '발렌타인 선물',    category: 'event_gift',     amount:  38000, payMethod: 'cash' },
  { type: 'expense', date: '2026-02-15', title: '주유',           category: 'car_fuel',       amount:  68000, payMethod: 'shinhan_card' },
  { type: 'expense', date: '2026-02-17', title: '카페 디저트',      category: 'food_cafe',      amount:  12800, payMethod: 'kakao_pay' },
  { type: 'expense', date: '2026-02-19', title: '택시',           category: 'transport_taxi', amount:  12800, payMethod: 'kakao_pay', memo: '야근 귀가' },
  { type: 'expense', date: '2026-02-21', title: '다이소',          category: 'living_daily',   amount:  15600, payMethod: 'debit_card' },
  { type: 'expense', date: '2026-02-22', title: '명절 부조',        category: 'event_condolence', amount: 100000, payMethod: 'bank_transfer', memo: '큰집' },
  { type: 'expense', date: '2026-02-24', title: '병원 진료',        category: 'health_hospital', amount: 23000, payMethod: 'shinhan_card', memo: '치과' },
  { type: 'income',  date: '2026-02-26', title: '명절 상여금',      category: 'income_salary',  amount: 300000, payMethod: 'bank_transfer', memo: '명절 상여' },
  { type: 'expense', date: '2026-02-27', title: '이마트 장보기',    category: 'food_grocery',   amount:  58300, payMethod: 'shinhan_card' },

  // ── 2026-03 ────────────────────────────────────────────────
  { type: 'expense', date: '2026-03-02', title: '쿠팡 생필품',      category: 'living_daily',   amount:  47600, payMethod: 'shinhan_card' },
  { type: 'expense', date: '2026-03-04', title: '스타벅스',        category: 'food_cafe',      amount:   6500, payMethod: 'kakao_pay' },
  { type: 'expense', date: '2026-03-06', title: '점심 백반',        category: 'food_dining',    amount:   9500, payMethod: 'cash' },
  { type: 'expense', date: '2026-03-08', title: '올리브영',        category: 'beauty_cosmetic', amount: 29400, payMethod: 'naver_pay' },
  { type: 'expense', date: '2026-03-09', title: '점심 회식',        category: 'food_dining',    amount:  32000, payMethod: 'cash' },
  { type: 'expense', date: '2026-03-11', title: '미용실',          category: 'beauty_hair',    amount:  35000, payMethod: 'shinhan_card', memo: '커트+펌' },
  { type: 'expense', date: '2026-03-13', title: '교통카드 충전',    category: 'transport_transit', amount: 50000, payMethod: 'kakao_pay' },
  { type: 'expense', date: '2026-03-15', title: 'KTX 부산',        category: 'transport_intercity', amount: 59800, payMethod: 'shinhan_card', memo: '주말 여행' },
  { type: 'expense', date: '2026-03-16', title: '부산 숙소',        category: 'leisure_travel', amount: 120000, payMethod: 'hyundai_card', memo: '1박' },
  { type: 'expense', date: '2026-03-16', title: '부산 맛집',        category: 'food_dining',    amount:  54000, payMethod: 'hyundai_card' },
  { type: 'expense', date: '2026-03-19', title: '인강 결제',        category: 'selfdev_edu',    amount:  99000, payMethod: 'shinhan_card', memo: '온라인 강의' },
  { type: 'expense', date: '2026-03-22', title: '이마트 장보기',    category: 'food_grocery',   amount:  76400, payMethod: 'shinhan_card' },
  { type: 'expense', date: '2026-03-25', title: '관리비',          category: 'etc_rentfee',    amount: 145000, payMethod: 'bank_transfer', memo: '아파트 관리비' },
  { type: 'income',  date: '2026-03-28', title: '카드 캐시백',      category: 'income_etc',     amount:  18500, payMethod: 'bank_transfer' },
  { type: 'income',  date: '2026-03-31', title: '예금 이자',        category: 'income_financial', amount: 25300, payMethod: 'bank_transfer', memo: '정기예금' },

  // ── 2026-04 ────────────────────────────────────────────────
  { type: 'expense', date: '2026-04-02', title: '이마트 장보기',    category: 'food_grocery',   amount:  69800, payMethod: 'shinhan_card' },
  { type: 'expense', date: '2026-04-04', title: '올리브영',        category: 'beauty_cosmetic', amount: 41200, payMethod: 'kakao_pay' },
  { type: 'expense', date: '2026-04-06', title: '스타벅스',        category: 'food_cafe',      amount:   7800, payMethod: 'kakao_pay' },
  { type: 'expense', date: '2026-04-08', title: '주유',           category: 'car_fuel',       amount:  70000, payMethod: 'shinhan_card' },
  { type: 'expense', date: '2026-04-11', title: '배달의민족',      category: 'food_dining',    amount:  24500, payMethod: 'kakao_pay', memo: '치킨' },
  { type: 'expense', date: '2026-04-13', title: '자동차 정비',      category: 'car_maintenance', amount: 180000, payMethod: 'hyundai_card', memo: '엔진오일+점검' },
  { type: 'expense', date: '2026-04-15', title: '쿠팡 생필품',      category: 'living_daily',   amount:  33700, payMethod: 'shinhan_card' },
  { type: 'expense', date: '2026-04-17', title: '친구 결혼식 축의금', category: 'event_condolence', amount: 100000, payMethod: 'cash' },
  { type: 'expense', date: '2026-04-19', title: '의류 쇼핑',        category: 'beauty_clothing', amount: 89000, payMethod: 'shinhan_card', memo: '무신사' },
  { type: 'expense', date: '2026-04-21', title: '점심 회식',        category: 'food_dining',    amount:  28000, payMethod: 'cash' },
  { type: 'expense', date: '2026-04-23', title: '교통카드 충전',    category: 'transport_transit', amount: 50000, payMethod: 'kakao_pay' },
  { type: 'expense', date: '2026-04-25', title: '관리비',          category: 'etc_rentfee',    amount: 138000, payMethod: 'bank_transfer', memo: '아파트 관리비' },
  { type: 'expense', date: '2026-04-27', title: '이마트 장보기',    category: 'food_grocery',   amount:  61500, payMethod: 'shinhan_card' },
  { type: 'income',  date: '2026-04-29', title: '중고거래 판매',    category: 'income_side',    amount:  60000, payMethod: 'bank_transfer', memo: '안 쓰는 모니터' },

  // ── 2026-05 ────────────────────────────────────────────────
  { type: 'expense', date: '2026-05-02', title: '이마트 장보기',    category: 'food_grocery',   amount:  73200, payMethod: 'shinhan_card' },
  { type: 'expense', date: '2026-05-04', title: '스타벅스',        category: 'food_cafe',      amount:   6500, payMethod: 'kakao_pay' },
  { type: 'expense', date: '2026-05-06', title: '부모님 선물',      category: 'event_gift',     amount: 150000, payMethod: 'bank_transfer', memo: '상품권' },
  { type: 'expense', date: '2026-05-08', title: '조카 생일 선물',    category: 'event_gift',    amount:  40000, payMethod: 'naver_pay' },
  { type: 'expense', date: '2026-05-10', title: '브런치 카페',      category: 'food_cafe',      amount:  24000, payMethod: 'kakao_pay' },
  { type: 'expense', date: '2026-05-13', title: '마트 장보기',      category: 'food_grocery',   amount:  67800, payMethod: 'shinhan_card' },
  { type: 'expense', date: '2026-05-15', title: '주유',           category: 'car_fuel',       amount:  65000, payMethod: 'shinhan_card' },
  { type: 'expense', date: '2026-05-17', title: '건강보조제',      category: 'health_supplement', amount: 48000, payMethod: 'naver_pay', memo: '비타민' },
  { type: 'expense', date: '2026-05-20', title: '영화 2매',        category: 'leisure_culture', amount: 28000, payMethod: 'kakao_pay' },
  { type: 'expense', date: '2026-05-22', title: '점심 회식',        category: 'food_dining',    amount:  35000, payMethod: 'cash' },
  { type: 'expense', date: '2026-05-24', title: '다이소',          category: 'living_daily',   amount:  18700, payMethod: 'debit_card' },
  { type: 'expense', date: '2026-05-25', title: '관리비',          category: 'etc_rentfee',    amount: 132000, payMethod: 'bank_transfer', memo: '아파트 관리비' },
  { type: 'expense', date: '2026-05-28', title: '가전 — 무선청소기', category: 'living_appliance', amount: 299000, payMethod: 'samsung_card', memo: '6개월 무이자' },
  { type: 'income',  date: '2026-05-31', title: '성과급',          category: 'income_salary',  amount: 500000, payMethod: 'bank_transfer', memo: '분기 인센티브' },

  // ── 2026-06 ────────────────────────────────────────────────
  { type: 'expense', date: '2026-06-01', title: '스타벅스',        category: 'food_cafe',      amount:   6500, payMethod: 'kakao_pay', memo: '아메리카노' },
  { type: 'expense', date: '2026-06-02', title: '교통카드 충전',    category: 'transport_transit', amount: 30000, payMethod: 'kakao_pay' },
  { type: 'expense', date: '2026-06-03', title: '이마트 장보기',    category: 'food_grocery',   amount:  81200, payMethod: 'shinhan_card' },
  { type: 'expense', date: '2026-06-04', title: '배달의민족',      category: 'food_dining',    amount:  27800, payMethod: 'kakao_pay', memo: '족발' },
  { type: 'expense', date: '2026-06-05', title: '쿠팡 생필품',      category: 'living_daily',   amount:  35400, payMethod: 'shinhan_card' },
  { type: 'expense', date: '2026-06-06', title: '주말 외식',        category: 'food_dining',    amount:  52000, payMethod: 'hyundai_card', memo: '가족 식사' },
  { type: 'expense', date: '2026-06-07', title: '카페 디저트',      category: 'food_cafe',      amount:  14300, payMethod: 'kakao_pay' },
  { type: 'income',  date: '2026-06-09', title: '중고거래 판매',    category: 'income_side',    amount:  35000, payMethod: 'bank_transfer', memo: '안 쓰는 이어폰' },
];

// 한 사용자에게 수입/지출 더미를 채운다 (기존 행 제거 후 재삽입 → idempotent)
// 자산이동(target) 거래는 예적금/투자 더미가 먼저 시드되어 있어야 이름으로 연동된다 (seed.ts 실행 순서 참고)
export const seedTransactions: SeedFn = async (prisma, userId) => {
  await prisma.transaction.deleteMany({ where: { user_id: userId } });
  // 자동이체 설정도 지운다 — 거래만 지우면 다시 넣을 때마다 설정이 겹겹이 쌓인다(반복매수 설정은 종목 삭제 때 같이 지워진다)
  await prisma.recurringSchedule.deleteMany({ where: { user_id: userId, kind: 'transaction' } });

  // target_type='investment'는 종목(Investment)이 아닌 투자 계좌(InvestmentAccount)를 가리킴(예수금은 계좌 단위)
  const [savings, investmentAccounts] = await Promise.all([
    prisma.saving.findMany({ where: { user_id: userId }, select: { id: true, name: true } }),
    prisma.investmentAccount.findMany({ where: { user_id: userId }, select: { id: true, name: true } }),
  ]);
  function targetIdOf(target?: { type: TransferTarget; name: string }): number | null {
    if (!target) return null;
    const list = target.type === 'saving' ? savings : investmentAccounts;
    return list.find((r) => r.name === target.name)?.id ?? null;
  }

  // 날짜를 실행일 기준으로 옮기고, 옮겨서 오늘 이후가 된 변동 거래는 뺀다(반복 거래 첫 회차는 다섯 달 전이라 늘 남는다).
  // 자동이체 기준일은 옮기기 전 날짜로 — 2월 같은 짧은 달로 옮겨지며 말일로 당겨진 날을 규칙에 쓰지 않으려고
  const rows = [...fixedRows(), ...VARIABLE]
    .map((t) => ({ ...t, authored: t.date, ruleDay: Number(t.date.slice(8)), date: ds(t.date) }))
    .filter((t) => t.date <= todayStr);
  let count = 0;
  for (const t of rows) {
    const targetId = targetIdOf(t.target);
    const targetType = targetId != null ? t.target!.type : null;
    // 반복 거래 회차: 첫 회차부터 오늘까지 매월. 원래는 예약 작업(매일 9시)이 채우지만, 시드 직후 이번 달 고정지출이 비지 않게 여기서 넣는다
    const dates = [t.date];
    if (t.recurring) {
      for (let k = 1; dsPlus(t.authored, k) <= todayStr; k++) dates.push(dsPlus(t.authored, k));
    }
    // 반복거래는 자동이체 설정(RecurringSchedule)을 먼저 만들고, 회차마다 그 설정에 연결된 평범한 거래로 등록
    const schedule = t.recurring
      ? await prisma.recurringSchedule.create({
        data: {
          user_id: userId,
          kind: 'transaction',
          rule: { cycle: 'monthly', day: t.ruleDay, weekendAdjust: t.weekendAdjust ?? 'none' },
          start_date: dAt(t.date),
          // 마지막으로 만든 회차 — 예약 작업은 그다음 달부터 만든다
          last_period: dates[dates.length - 1].slice(0, 7),
          tx_type: t.type,
          title: t.title,
          category: t.category,
          amount: t.amount,
          pay_method: t.type === 'expense' ? t.payMethod : '',
          memo: t.memo ?? null,
          target_type: targetType,
          target_id: targetId,
        },
      })
      : null;

    await prisma.transaction.createMany({
      data: dates.map((date) => ({
        user_id: userId,
        type: t.type,
        date: dAt(date),
        title: t.title,
        category: t.category,
        amount: t.amount,
        // 결제수단은 지출에만 의미 — 수입/자산이동은 빈값 저장
        pay_method: t.type === 'expense' ? t.payMethod : '',
        memo: t.memo ?? null,
        recurring_schedule_id: schedule?.id ?? null,
        // 반복 회차면 자신의 회차 식별 (자동 생성 시 중복 방지)
        recurring_period: schedule ? date.slice(0, 7) : null,
        target_type: targetType,
        target_id: targetId,
      })),
    });
    count += dates.length;
  }
  return count;
};
