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
};

// 도메인별 기본 카테고리 목록
const CATEGORIES: CatSeed[] = [
  // ── 가계부 ──────────────────────────────
  { domain: 'transaction', code: 'food',         label: '식비' },
  { domain: 'transaction', code: 'transport',    label: '교통' },
  { domain: 'transaction', code: 'subscription', label: '구독' },
  { domain: 'transaction', code: 'shopping',     label: '쇼핑' },
  { domain: 'transaction', code: 'medical',      label: '의료' },
  { domain: 'transaction', code: 'leisure',      label: '여가' },
  { domain: 'transaction', code: 'education',    label: '교육' },
  { domain: 'transaction', code: 'utility',      label: '공과금' },
  { domain: 'transaction', code: 'salary',       label: '급여' },
  { domain: 'transaction', code: 'freelance',    label: '부수입' },
  { domain: 'transaction', code: 'transfer',     label: '이체' },
  { domain: 'transaction', code: 'etc',          label: '기타' },

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
  { domain: 'asset', code: 'realestate',  label: '부동산' },
  { domain: 'asset', code: 'debt',        label: '부채' },
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

  // ── ENV 그룹 ─────────────────────────────
  { domain: 'env_group', code: 'database', label: 'Database' },
  { domain: 'env_group', code: 'auth',     label: 'Auth' },
  { domain: 'env_group', code: 'storage',  label: 'Storage' },
  { domain: 'env_group', code: 'api_keys', label: 'API Keys' },
  { domain: 'env_group', code: 'app',      label: 'App' },
  { domain: 'env_group', code: 'etc',      label: '기타' },
];

// 카테고리 시드 — 기존 전체 삭제 후 재삽입 (idempotent)
export const seedCategories: SeedFn = async (prisma, userId) => {
  // 기존 데이터 삭제
  await prisma.category.deleteMany({ where: { user_id: userId } });

  // 도메인별 정렬 순서(sort_order)를 0부터 부여해 삽입
  const domainCounters: Record<string, number> = {};

  await prisma.category.createMany({
    data: CATEGORIES.map((c) => {
      domainCounters[c.domain] ??= 1;
      const sort_order = domainCounters[c.domain]++;
      return {
        user_id:    userId,
        domain:     c.domain,
        code:       c.code,
        label:      c.label,
        sort_order,
        is_active:  true,
      };
    }),
  });

  return CATEGORIES.length;
};
