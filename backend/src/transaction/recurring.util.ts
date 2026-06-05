/**
 * 반복 거래 회차 날짜 계산 유틸 (순수 함수).
 * transaction.service 의 자동 생성(materializeRecurring)에서 사용하며, 단위 테스트 대상이다.
 */

// 반복 규칙 형태
export interface RRule {
  cycle: 'monthly' | 'weekly' | 'yearly';
  day: number;
  weekendAdjust?: 'none' | 'before' | 'after';
}

// Date → 'YYYY-MM-DD' (UTC 기준, @db.Date 는 시각 정보 없음)
export function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// 반복 회차 식별자 — 월간 'YYYY-MM' / 연간 'YYYY' / 주간 'YYYY-MM-DD'
export function periodOf(d: Date, cycle: string): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  if (cycle === 'yearly') return String(y);
  if (cycle === 'weekly') return toDateStr(d);
  return `${y}-${m}`;
}

// 주말이면 앞/뒤 평일로 보정 (none 은 그대로)
export function adjustWeekend(d: Date, mode?: string): Date {
  const wd = d.getUTCDay(); // 0 일 .. 6 토
  if (mode === 'before') {
    if (wd === 6) d.setUTCDate(d.getUTCDate() - 1);
    else if (wd === 0) d.setUTCDate(d.getUTCDate() - 2);
  } else if (mode === 'after') {
    if (wd === 6) d.setUTCDate(d.getUTCDate() + 2);
    else if (wd === 0) d.setUTCDate(d.getUTCDate() + 1);
  }
  return d;
}

// 해당 (연,월)의 기준일 날짜 — 말일 초과 시 말일로 클램프 + 주말 보정
export function monthlyDate(y: number, m: number, day: number, adj?: string): Date {
  const dim = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return adjustWeekend(new Date(Date.UTC(y, m, Math.min(day, dim))), adj);
}

// 템플릿 기준 i번째 회차 날짜
export function nthOccurrence(base: Date, rule: RRule, i: number): Date {
  const y = base.getUTCFullYear();
  const m = base.getUTCMonth();
  const day = rule.day || base.getUTCDate();
  if (rule.cycle === 'weekly') {
    const d = new Date(base);
    d.setUTCDate(d.getUTCDate() + 7 * i);
    return adjustWeekend(d, rule.weekendAdjust);
  }
  if (rule.cycle === 'yearly') return monthlyDate(y + i, m, day, rule.weekendAdjust);
  return monthlyDate(y, m + i, day, rule.weekendAdjust); // monthly
}

// 'YYYY-MM' → 해당 월 [시작, 다음달 시작) 범위
export function monthRange(month: string): { gte: Date; lt: Date } {
  const [y, m] = month.split('-').map(Number);
  const gte = new Date(Date.UTC(y, m - 1, 1));
  const lt = new Date(Date.UTC(y, m, 1));
  return { gte, lt };
}
