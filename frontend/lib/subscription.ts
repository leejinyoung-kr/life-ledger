/**
 * 구독 관리 공통 타입 · 라벨맵 · 옵션.
 * 백엔드 응답 DTO(/subscriptions)와 1:1 대응한다. 포맷 유틸(won/dotDate/daysUntil)은
 * 가계부와 공유하므로 lib/finance 에서 가져다 쓴다.
 */

// ── 타입 ────────────────────────────────────────────────────────
export type SubscriptionCycle = 'monthly' | 'yearly' | 'weekly';
export type SubscriptionStatus = 'active' | 'trial' | 'paused';

export interface Subscription {
  id: number;
  name: string;
  category: string; // 코드
  amount: number;
  cycle: SubscriptionCycle;
  status: SubscriptionStatus;
  nextPaymentDate: string; // YYYY-MM-DD
  payMethod: string;
  lastUsedAt: string | null;
  memo: string | null;
}

export interface SubscriptionSummary {
  monthlyTotal: number;
  yearlyTotal: number;
  activeCount: number;
  nextPayment: { days: number; name: string } | null;
  // 체험 종료 임박 배너용 — 첫 체험 구독 (목록 페이징과 무관). 결제일은 항상 존재
  trial: { id: number; name: string; amount: number; cycle: SubscriptionCycle; nextPaymentDate: string } | null;
}

export interface UnusedSubscription {
  id: number;
  name: string;
  category: string;
  status: SubscriptionStatus;
  monthlyCost: number;
  lastUsedAt: string | null;
  daysSince: number | null;
}

// ── 라벨맵 (코드 ↔ 화면 표시) ────────────────────────────────────
// 카테고리 코드 → 한글 라벨
export const SUB_CATEGORY_LABEL: Record<string, string> = {
  ott: 'OTT · 엔터테인먼트',
  music: '음악',
  cloud: '클라우드',
  shopping: '쇼핑 멤버십',
  ai: 'AI · 생산성',
  etc: '기타',
};

// 카테고리 코드 → 카드 로고 이모지
export const SUB_CATEGORY_EMOJI: Record<string, string> = {
  ott: '📺',
  music: '🎵',
  cloud: '☁️',
  shopping: '📦',
  ai: '🤖',
  etc: '🧩',
};

// 구독 입력 폼 카테고리 옵션
export const SUB_CATEGORY_OPTIONS: { value: string; label: string }[] = [
  { value: 'ott', label: 'OTT · 엔터테인먼트' },
  { value: 'music', label: '음악' },
  { value: 'cloud', label: '클라우드' },
  { value: 'shopping', label: '쇼핑 멤버십' },
  { value: 'ai', label: 'AI · 생산성' },
  { value: 'etc', label: '기타' },
];

export const CYCLE_LABEL: Record<SubscriptionCycle, string> = {
  monthly: '월',
  yearly: '년',
  weekly: '주',
};

export const STATUS_LABEL: Record<SubscriptionStatus, string> = {
  active: '활성',
  trial: '체험',
  paused: '일시정지',
};

// 상태 → 배지 클래스
export const STATUS_BADGE: Record<SubscriptionStatus, string> = {
  active: 'badge-success',
  trial: 'badge-warning',
  paused: 'badge-neutral',
};

export const SUB_PAY_METHODS = ['신한카드', '카카오페이', '쿠페이', '해외결제', '계좌이체'];
