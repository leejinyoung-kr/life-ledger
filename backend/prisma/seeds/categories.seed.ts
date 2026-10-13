/**
 * 카테고리(Category) 더미.
 * 도메인별(가계부/구독/자산/투자/예적금) 기본 카테고리를 설정한다.
 * 시드 실행 시 기존 데이터를 전부 지우고 재삽입해 idempotent하게 동작한다.
 */
import type { CategoryDomain } from '@prisma/client';
import type { SeedFn } from './helpers';

type CatSeed = {
  domain: CategoryDomain;
  code: string;
  label: string;
  parent_code?: string; // 소분류만 채움 (대분류·단일계층 도메인은 미지정 → NULL)
};

// 가계부 2계층 트리 (대분류 → 소분류) — flat CatSeed 로 펼쳐서 사용. 모든 대분류에 기타(catch-all) 포함(AI 파싱 fallback)
const TX_TREE: { code: string; label: string; children: [string, string][] }[] = [
  { code: 'food',      label: '식비',     children: [['food_grocery', '식료품'], ['food_dining', '외식'], ['food_cafe', '카페·간식'], ['food_etc', '기타(식비)']] },
  { code: 'beauty',    label: '꾸밈비',   children: [['beauty_clothing', '의류·잡화'], ['beauty_cosmetic', '화장품'], ['beauty_hair', '미용'], ['beauty_etc', '기타(꾸밈비)']] },
  { code: 'living',    label: '생활비',   children: [['living_daily', '생필품'], ['living_appliance', '가구·가전'], ['living_housing', '주거관련'], ['living_etc', '기타(생활비)']] },
  { code: 'insurance', label: '보험·통신', children: [['insurance_telecom', '통신비'], ['insurance_premium', '보험'], ['insurance_subscription', '구독·정기결제'], ['insurance_etc', '기타(보험·통신)']] },
  { code: 'car',       label: '차량유지', children: [['car_fuel', '유류비'], ['car_maintenance', '정비·수리'], ['car_etc', '기타(차량)']] },
  { code: 'transport', label: '교통비',   children: [['transport_transit', '대중교통'], ['transport_taxi', '택시'], ['transport_intercity', '시외·항공'], ['transport_etc', '기타(교통)']] },
  { code: 'leisure',   label: '여가생활', children: [['leisure_travel', '여행'], ['leisure_culture', '영화·공연'], ['leisure_exercise', '운동'], ['leisure_etc', '기타(여가)']] },
  { code: 'health',    label: '건강',     children: [['health_hospital', '병원'], ['health_pharmacy', '약국'], ['health_supplement', '건강보조제'], ['health_etc', '기타(건강)']] },
  { code: 'selfdev',   label: '자기계발', children: [['selfdev_book', '도서'], ['selfdev_edu', '교육·강의'], ['selfdev_etc', '기타(자기계발)']] },
  { code: 'event',     label: '경조사',   children: [['event_condolence', '부조'], ['event_gift', '선물'], ['event_gathering', '모임·회비'], ['event_etc', '기타(경조사)']] },
  { code: 'etc',       label: '기타',     children: [['etc_interest', '이자'], ['etc_fee', '수수료'], ['etc_tax', '세금'], ['etc_rentfee', '임대관리비'], ['etc_etc', '기타']] },
  { code: 'income',    label: '수입',     children: [['income_salary', '급여'], ['income_side', '부수입'], ['income_financial', '금융수입'], ['income_etc', '기타수입']] },
  { code: 'transfer',  label: '이체',     children: [['transfer_move', '저축·계좌이체']] },
];

// TX_TREE → flat CatSeed (대분류 행 + 소분류 행, 트리 순서 유지)
const TX_CATEGORIES: CatSeed[] = TX_TREE.flatMap((p) => [
  { domain: 'transaction' as const, code: p.code, label: p.label },
  ...p.children.map(([code, label]) => ({ domain: 'transaction' as const, code, label, parent_code: p.code })),
]);

// 도메인별 기본 카테고리 목록
const CATEGORIES: CatSeed[] = [
  // ── 가계부 (대분류→소분류) ───────────────
  ...TX_CATEGORIES,

  // ── 구독 ────────────────────────────────
  { domain: 'subscription', code: 'ott',      label: 'OTT' },
  { domain: 'subscription', code: 'music',    label: '음악' },
  { domain: 'subscription', code: 'software', label: '소프트웨어' },
  { domain: 'subscription', code: 'game',     label: '게임' },
  { domain: 'subscription', code: 'cloud',    label: '클라우드' },
  { domain: 'subscription', code: 'ai',       label: 'AI 서비스' },
  { domain: 'subscription', code: 'news',     label: '뉴스/매거진' },
  { domain: 'subscription', code: 'fitness',  label: '피트니스' },
  { domain: 'subscription', code: 'shopping', label: '쇼핑 멤버십' },
  { domain: 'subscription', code: 'etc',      label: '기타' },

  // ── 자산 ────────────────────────────────
  { domain: 'asset', code: 'cash',        label: '현금성' },
  { domain: 'asset', code: 'savings',     label: '예적금' },
  { domain: 'asset', code: 'investment',  label: '투자' },
  { domain: 'asset', code: 'etc',         label: '기타' },

  // ── 투자 ────────────────────────────────
  { domain: 'investment', code: 'domestic_stock', label: '국내주식' },
  { domain: 'investment', code: 'foreign_stock',  label: '해외주식' },
  { domain: 'investment', code: 'domestic_etf',   label: '국내ETF' },
  { domain: 'investment', code: 'foreign_etf',    label: '해외ETF' },
  { domain: 'investment', code: 'crypto',         label: '가상자산' },
  { domain: 'investment', code: 'etc',            label: '기타' },

  // ── 예적금 ──────────────────────────────
  { domain: 'saving', code: 'savings',      label: '적금' },
  { domain: 'saving', code: 'deposit',      label: '예금' },
  { domain: 'saving', code: 'subscription', label: '청약' },
  { domain: 'saving', code: 'etc',          label: '기타' },

  // ── 결제수단 ────────────────────────────
  { domain: 'pay_method', code: 'shinhan_card',  label: '신한카드' },
  { domain: 'pay_method', code: 'hyundai_card',  label: '현대카드' },
  { domain: 'pay_method', code: 'kb_card',       label: 'KB카드' },
  { domain: 'pay_method', code: 'samsung_card',  label: '삼성카드' },
  { domain: 'pay_method', code: 'kakao_pay',     label: '카카오페이' },
  { domain: 'pay_method', code: 'naver_pay',     label: '네이버페이' },
  { domain: 'pay_method', code: 'toss',          label: '토스' },
  { domain: 'pay_method', code: 'bank_transfer', label: '계좌이체' },
  { domain: 'pay_method', code: 'debit_card',    label: '체크카드' },
  { domain: 'pay_method', code: 'cash',          label: '현금' },
  { domain: 'pay_method', code: 'foreign',       label: '해외결제' },

  // ── 은행/금융기관 (수입 입금처·예적금 기관 공용) ──
  { domain: 'bank', code: 'hana',      label: '하나은행' },
  { domain: 'bank', code: 'shinhan',   label: '신한은행' },
  { domain: 'bank', code: 'kb',        label: 'KB국민은행' },
  { domain: 'bank', code: 'woori',     label: '우리은행' },
  { domain: 'bank', code: 'ibk',       label: 'IBK기업은행' },
  { domain: 'bank', code: 'nh',        label: 'NH농협은행' },
  { domain: 'bank', code: 'sc',        label: 'SC제일은행' },
  { domain: 'bank', code: 'citi',      label: '한국씨티은행' },
  { domain: 'bank', code: 'kdb',       label: 'KDB산업은행' },
  { domain: 'bank', code: 'suhyup',    label: 'Sh수협은행' },
  { domain: 'bank', code: 'im',        label: 'iM뱅크' },
  { domain: 'bank', code: 'busan',     label: 'BNK부산은행' },
  { domain: 'bank', code: 'gyeongnam', label: 'BNK경남은행' },
  { domain: 'bank', code: 'gwangju',   label: '광주은행' },
  { domain: 'bank', code: 'jeonbuk',   label: '전북은행' },
  { domain: 'bank', code: 'jeju',      label: '제주은행' },
  { domain: 'bank', code: 'kakaobank', label: '카카오뱅크' },
  { domain: 'bank', code: 'tossbank',  label: '토스뱅크' },
  { domain: 'bank', code: 'kbank',     label: '케이뱅크' },
  { domain: 'bank', code: 'post',      label: '우체국예금' },
  { domain: 'bank', code: 'saemaul',   label: '새마을금고' },
  { domain: 'bank', code: 'shinhyup',  label: '신협' },
  { domain: 'bank', code: 'etc',       label: '기타' },

  // ── 계정 보관함 카테고리 ─────────────────
  { domain: 'credential_cat', code: 'dev',       label: '개발' },
  { domain: 'credential_cat', code: 'finance',   label: '금융' },
  { domain: 'credential_cat', code: 'social',    label: '소셜' },
  { domain: 'credential_cat', code: 'shopping',  label: '쇼핑' },
  { domain: 'credential_cat', code: 'sub',       label: '구독' },
  { domain: 'credential_cat', code: 'work',      label: '업무' },
  { domain: 'credential_cat', code: 'etc',       label: '기타' },

  // ── 신원지갑 종류 ────────────────────────
  { domain: 'id_type', code: 'passport',    label: '여권' },
  { domain: 'id_type', code: 'resident_id', label: '주민등록증' },
  { domain: 'id_type', code: 'driver',      label: '운전면허' },
  { domain: 'id_type', code: 'cert',        label: '자격증' },
  { domain: 'id_type', code: 'etc',         label: '기타' },

];

// 카테고리 시드 — 전역 공용(user 무관). 기존 전체 삭제 후 재삽입 (idempotent)
// 오케스트레이터가 유저별로 호출해도 전역 1세트만 유지(전체 wipe+재삽입). created_by 에 실행 유저 기록(감사용)
export const seedCategories: SeedFn = async (prisma, userId) => {
  // 전역 카테고리 전체 삭제
  await prisma.category.deleteMany({});

  // 도메인별 정렬 순서(sort_order)를 1부터 부여해 삽입
  const domainCounters: Record<string, number> = {};

  await prisma.category.createMany({
    data: CATEGORIES.map((c) => {
      domainCounters[c.domain] ??= 1;
      const sort_order = domainCounters[c.domain]++;
      return {
        domain:      c.domain,
        code:        c.code,
        label:       c.label,
        parent_code: c.parent_code ?? null,
        sort_order,
        is_active:   true,
        created_by:  userId,
      };
    }),
  });

  return CATEGORIES.length;
};
