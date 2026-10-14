/**
 * 자산 종합 공통 타입 · 라벨/색상맵.
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
  changeAmount: number | null; // 직전 월말 스냅샷이 없으면 null
  changeRate: number | null;
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

// 자산 구성 띠/점 색 — 금액 부호가 없는 자리라 강조색(초록)의 진하기로 구분한다
export const ASSET_TYPE_COLOR: Record<AssetType, string> = {
  cash: 'color-mix(in srgb, var(--accent) 35%, transparent)',
  savings: 'var(--accent)',
  investment: 'var(--accent-dark)',
};

// 자산 구성 표시 순서
export const ASSET_TYPE_ORDER: AssetType[] = ['cash', 'savings', 'investment'];

// 자산 구성 줄 이름
export const BY_TYPE_NAME: Record<AssetType, string> = {
  cash: '현금성 자산',
  savings: '예적금',
  investment: '투자',
};
