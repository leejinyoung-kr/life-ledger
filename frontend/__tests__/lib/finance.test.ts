import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  won, signedWon, dotDate, daysUntil, currentMonth, recurringRuleSummary,
  type RecurringRule,
} from '../../lib/finance';

describe('won', () => {
  it('천단위 콤마 + ₩ 접두', () => expect(won(1234000)).toBe('₩1,234,000'));
  it('음수는 앞에 - 를 붙인다', () => expect(won(-5000)).toBe('-₩5,000'));
  it('0', () => expect(won(0)).toBe('₩0'));
});

describe('signedWon', () => {
  it('수입은 +', () => expect(signedWon('income', 1000)).toBe('+₩1,000'));
  it('지출은 -', () => expect(signedWon('expense', 1000)).toBe('-₩1,000'));
  it('자산이동도 -', () => expect(signedWon('transfer', 1000)).toBe('-₩1,000'));
});

describe('dotDate', () => {
  it('YYYY-MM-DD → YYYY.MM.DD', () => expect(dotDate('2026-06-05')).toBe('2026.06.05'));
});

describe('daysUntil', () => {
  afterEach(() => vi.useRealTimers());

  it('null → null', () => expect(daysUntil(null)).toBeNull());

  it('30일 후 날짜 → 30', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-01T00:00:00'));
    expect(daysUntil('2026-07-01')).toBe(30);
  });

  it('과거 날짜 → 음수', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-10T00:00:00'));
    expect(daysUntil('2026-06-01')).toBeLessThan(0);
  });
});

describe('currentMonth', () => {
  afterEach(() => vi.useRealTimers());

  it('YYYY-MM 형식, 월 0패딩', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-15T00:00:00'));
    expect(currentMonth()).toBe('2026-03');
  });
});

describe('recurringRuleSummary', () => {
  it('daily → 매일 (평일만)', () => {
    const rule: RecurringRule = { cycle: 'daily', day: 0, weekendAdjust: 'none' };
    expect(recurringRuleSummary(rule)).toBe('매일 (평일만)');
  });

  it('monthly → 매월 N일', () => {
    const rule: RecurringRule = { cycle: 'monthly', day: 15, weekendAdjust: 'none' };
    expect(recurringRuleSummary(rule)).toBe('매월 15일');
  });

  it('weekly → 매주 N요일', () => {
    const rule: RecurringRule = { cycle: 'weekly', day: 2, weekendAdjust: 'none' };
    expect(recurringRuleSummary(rule)).toBe('매주 화요일');
  });

  it('yearly + month 지정 → 매년 N월 N일', () => {
    const rule: RecurringRule = { cycle: 'yearly', day: 15, month: 3, weekendAdjust: 'none' };
    expect(recurringRuleSummary(rule)).toBe('매년 3월 15일');
  });

  it('yearly + month 미지정 → 매년 N일 (월 누락)', () => {
    const rule: RecurringRule = { cycle: 'yearly', day: 15, weekendAdjust: 'none' };
    expect(recurringRuleSummary(rule)).toBe('매년 15일');
  });
});
