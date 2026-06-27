import {
  periodOf, adjustWeekend, monthlyDate, nthOccurrence, monthRange, toDateStr, isWeekday,
  type RRule,
} from './recurring.util';

const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m, d));

describe('recurring.util', () => {
  describe('periodOf', () => {
    const d = utc(2026, 5, 5); // 2026-06-05
    it('monthly → YYYY-MM', () => expect(periodOf(d, 'monthly')).toBe('2026-06'));
    it('yearly → YYYY-MM (월 포함 — 같은 해라도 월이 다르면 별개 회차)', () => expect(periodOf(d, 'yearly')).toBe('2026-06'));
    it('weekly → YYYY-MM-DD', () => expect(periodOf(d, 'weekly')).toBe('2026-06-05'));
    it('daily → YYYY-MM-DD', () => expect(periodOf(d, 'daily')).toBe('2026-06-05'));
  });

  describe('isWeekday', () => {
    it('토·일은 false', () => {
      expect(isWeekday(utc(2026, 5, 6))).toBe(false); // 토
      expect(isWeekday(utc(2026, 5, 7))).toBe(false); // 일
    });
    it('월~금은 true', () => expect(isWeekday(utc(2026, 5, 5))).toBe(true)); // 금
  });

  describe('adjustWeekend', () => {
    // 2026-06-06 = 토, 06-07 = 일, 06-05 = 금, 06-08 = 월
    it('before: 토→금', () => expect(toDateStr(adjustWeekend(utc(2026, 5, 6), 'before'))).toBe('2026-06-05'));
    it('before: 일→금(-2)', () => expect(toDateStr(adjustWeekend(utc(2026, 5, 7), 'before'))).toBe('2026-06-05'));
    it('after: 토→월(+2)', () => expect(toDateStr(adjustWeekend(utc(2026, 5, 6), 'after'))).toBe('2026-06-08'));
    it('after: 일→월(+1)', () => expect(toDateStr(adjustWeekend(utc(2026, 5, 7), 'after'))).toBe('2026-06-08'));
    it('none: 그대로', () => expect(toDateStr(adjustWeekend(utc(2026, 5, 6), 'none'))).toBe('2026-06-06'));
    it('평일은 모드 무관 그대로', () => expect(toDateStr(adjustWeekend(utc(2026, 5, 5), 'before'))).toBe('2026-06-05'));
  });

  describe('monthlyDate (말일 클램프)', () => {
    it('2월에 31일 지정 → 28일로 클램프(2026 비윤년)', () =>
      expect(toDateStr(monthlyDate(2026, 1, 31))).toBe('2026-02-28'));
    it('정상 일자는 그대로', () =>
      expect(toDateStr(monthlyDate(2026, 5, 6))).toBe('2026-06-06'));
  });

  describe('nthOccurrence', () => {
    const monthly: RRule = { cycle: 'monthly', day: 15 };
    it('monthly i번째 = 그달 같은 일자', () => {
      const base = utc(2026, 0, 15);
      expect(toDateStr(nthOccurrence(base, monthly, 0))).toBe('2026-01-15');
      expect(toDateStr(nthOccurrence(base, monthly, 1))).toBe('2026-02-15');
      expect(toDateStr(nthOccurrence(base, monthly, 5))).toBe('2026-06-15');
    });
    it('monthly 말일 클램프', () => {
      const base = utc(2026, 0, 31);
      expect(toDateStr(nthOccurrence(base, { cycle: 'monthly', day: 31 }, 1))).toBe('2026-02-28');
    });
    it('yearly i번째 = 다음 해, month 미지정 시 시작월 유지', () => {
      const base = utc(2026, 0, 15); // 2026-01-15
      expect(toDateStr(nthOccurrence(base, { cycle: 'yearly', day: 15 }, 1))).toBe('2027-01-15');
    });
    it('yearly month 지정 시 그 달로 고정', () => {
      const base = utc(2026, 0, 15); // 2026-01-15(1월)
      expect(toDateStr(nthOccurrence(base, { cycle: 'yearly', day: 15, month: 3 }, 0))).toBe('2026-03-15');
      expect(toDateStr(nthOccurrence(base, { cycle: 'yearly', day: 15, month: 3 }, 1))).toBe('2027-03-15');
    });
    it('weekly 시작일과 같은 요일 지정 시 +7*i 일', () => {
      const base = utc(2026, 5, 5); // 2026-06-05 = 금(5)
      expect(toDateStr(nthOccurrence(base, { cycle: 'weekly', day: 5 }, 0))).toBe('2026-06-05');
      expect(toDateStr(nthOccurrence(base, { cycle: 'weekly', day: 5 }, 1))).toBe('2026-06-12');
      expect(toDateStr(nthOccurrence(base, { cycle: 'weekly', day: 5 }, 2))).toBe('2026-06-19');
    });
    it('weekly 다른 요일 지정 시 시작일 이후 그 요일로 스냅', () => {
      const base = utc(2026, 5, 5); // 2026-06-05 = 금(5)
      // 월(1)요일은 금요일 다음 주 월요일(06-08)부터
      expect(toDateStr(nthOccurrence(base, { cycle: 'weekly', day: 1 }, 0))).toBe('2026-06-08');
      expect(toDateStr(nthOccurrence(base, { cycle: 'weekly', day: 1 }, 1))).toBe('2026-06-15');
    });
    it('daily 평일만 카운트 — 금요일 시작 시 다음 평일은 월요일', () => {
      const base = utc(2026, 5, 5); // 2026-06-05 = 금
      const daily: RRule = { cycle: 'daily', day: 0 };
      expect(toDateStr(nthOccurrence(base, daily, 1))).toBe('2026-06-08'); // 토·일 건너뜀 → 월
      expect(toDateStr(nthOccurrence(base, daily, 2))).toBe('2026-06-09'); // 화
      expect(toDateStr(nthOccurrence(base, daily, 5))).toBe('2026-06-12'); // 금(다음주)
    });
    it('daily 평일 시작 시 그 다음날도 평일이면 그대로 +1일', () => {
      const base = utc(2026, 5, 1); // 2026-06-01 = 월
      const daily: RRule = { cycle: 'daily', day: 0 };
      expect(toDateStr(nthOccurrence(base, daily, 1))).toBe('2026-06-02'); // 화
      expect(toDateStr(nthOccurrence(base, daily, 4))).toBe('2026-06-05'); // 금
    });
  });

  describe('monthRange', () => {
    it('YYYY-MM → [그달 1일, 다음달 1일)', () => {
      const { gte, lt } = monthRange('2026-06');
      expect(gte.toISOString()).toBe('2026-06-01T00:00:00.000Z');
      expect(lt.toISOString()).toBe('2026-07-01T00:00:00.000Z');
    });
    it('12월 경계 → 다음 해 1월', () => {
      expect(monthRange('2026-12').lt.toISOString()).toBe('2027-01-01T00:00:00.000Z');
    });
  });
});
