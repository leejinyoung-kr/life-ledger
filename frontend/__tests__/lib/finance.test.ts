import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  won, signedWon, dotDate, daysUntil, currentMonth, recurringRuleSummary, activeWith, categoryOptions, enumOptions, enumLabel,
  type RecurringRule, type Category,
} from '../../lib/finance';

// 테스트용 카테고리 행
const cat = (code: string, isActive: boolean, parentCode: string | null = null): Category =>
  ({ id: 0, domain: 'transaction', code, label: code, parentCode, sortOrder: 0, isActive });

describe('activeWith', () => {
  const all = [cat('off', false), cat('a', true), cat('b', true)];
  it('사용 중인 것만', () => expect(activeWith(all).map((c) => c.code)).toEqual(['a', 'b']));
  it('기존 값은 비활성이어도 맨 뒤에 남긴다 — 첫 항목(기본값)은 사용 중인 것', () =>
    expect(activeWith(all, 'off').map((c) => c.code)).toEqual(['a', 'b', 'off']));
});

describe('enumOptions · enumLabel', () => {
  const fixed = { a: '고정A', b: '고정B', c: '고정C' };
  // 코드 관리: b 를 앞에 두고 라벨 변경, a 는 숨김, c 는 없음, x 는 백엔드가 모르는 새 코드
  const all = [{ ...cat('b', true), label: '바뀐B' }, cat('a', false), cat('x', true)];
  it('라벨 · 순서 · 숨김은 코드 관리, 없는 고정 값은 뒤에, 모르는 코드는 뺀다', () =>
    expect(enumOptions(fixed, all)).toEqual([{ value: 'b', label: '바뀐B' }, { value: 'c', label: '고정C' }]));
  it('기존 값은 숨김이어도 남긴다', () =>
    expect(enumOptions(fixed, all, 'a').map((o) => o.value)).toEqual(['b', 'a', 'c']));
  it('라벨은 코드 관리(숨김 포함), 없으면 고정 라벨', () => {
    expect(enumLabel(fixed, all, 'b')).toBe('바뀐B');
    expect(enumLabel(fixed, all, 'c')).toBe('고정C');
  });
});

describe('categoryOptions', () => {
  const all = [cat('food', true), cat('food_cafe', true, 'food'), cat('old', false), cat('old_x', false, 'old')];
  it('기존 소분류가 비활성이면 그 소분류와 대분류를 남긴다', () => {
    const { parents, leaves } = categoryOptions(all, 'old_x');
    expect(parents.map((c) => c.code)).toEqual(['food', 'old']);
    expect(leaves.map((c) => c.code)).toEqual(['food_cafe', 'old_x']);
  });
  it('기존 값이 없으면 사용 중인 것만', () => {
    const { parents, leaves } = categoryOptions(all);
    expect(parents.map((c) => c.code)).toEqual(['food']);
    expect(leaves.map((c) => c.code)).toEqual(['food_cafe']);
  });
});

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
