/**
 * 목표 공통 타입 · 포맷 유틸.
 * 백엔드 응답 DTO(/goals)와 1:1 대응한다.
 */

export type GoalTone = 'green' | 'warning' | 'danger';

export interface Goal {
  id: number;
  name: string;
  unit: 'won' | 'percent';
  currentVal: number;
  targetVal: number;
  pct: number;
  tone: GoalTone;
}

// 단위별 값 표기 (won → ₩1,000,000 / percent → 38%)
export function formatGoalValue(unit: 'won' | 'percent', val: number): string {
  return unit === 'percent' ? `${val}%` : `₩${val.toLocaleString('ko-KR')}`;
}
