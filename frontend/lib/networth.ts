/**
 * 자산 종합 공통 타입 · 라벨/색상맵 · 포맷 유틸.
 * 백엔드 응답 DTO(/assets)와 1:1 대응한다. 원화 전체표기 won() 은 lib/finance 와 공유.
 */

// ── 타입 ────────────────────────────────────────────────────────
export type AssetType = 'cash' | 'savings' | 'investment';

export interface AllocationItem {
  type: AssetType;
  amount: number;
  percent: number;
}

export interface ByTypeItem {
  type: AssetType;
  amount: number;
  count: number;
  avgRate: number | null;
}

export interface NetWorthSummary {
  totalAssets: number;
  netWorth: number;
  changeAmount: number;
  changeRate: number;
  allocation: AllocationItem[];
  byType: ByTypeItem[];
}

export interface TrendPoint {
  month: string;
  label: string;
  netWorth: number;
  current: boolean;
}

// ── 라벨/색상맵 ──────────────────────────────────────────────────
export const ASSET_TYPE_LABEL: Record<AssetType, string> = {
  cash: '현금',
  savings: '예적금',
  investment: '투자',
};

// 도넛/범례 색상 (CSS 변수)
export const ASSET_TYPE_COLOR: Record<AssetType, string> = {
  investment: 'var(--accent)',
  savings: 'var(--amber)',
  cash: 'var(--text-muted)',
};

// 유형별 통계 카드 메타 (아이콘/톤/라벨)
export const BY_TYPE_CARD: Record<string, { icon: string; tone: 'green' | 'red' | 'blue' | 'amber'; label: string }> = {
  cash: { icon: '💵', tone: 'green', label: '현금성 자산' },
  savings: { icon: '🏦', tone: 'blue', label: '예적금' },
  investment: { icon: '📈', tone: 'amber', label: '투자' },
};

// ── 포맷 유틸 ────────────────────────────────────────────────────
// 백만 단위 압축 표기 (₩142.8M)
export function wonM(n: number): string {
  return `₩${(n / 1_000_000).toFixed(1)}M`;
}

// 백만 단위 정수 라벨 (143M) — 차트 막대 내부용
export function millionsLabel(n: number): string {
  return `${Math.round(n / 1_000_000)}M`;
}
