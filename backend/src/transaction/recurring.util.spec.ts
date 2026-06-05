import {
  periodOf, adjustWeekend, monthlyDate, nthOccurrence, monthRange, toDateStr,
  type RRule,
} from './recurring.util';

const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m, d));

describe('recurring.util', () => {
  describe('periodOf', () => {
    const d = utc(2026, 5, 5); // 2026-06-05
    it('monthly → YYYY-MM', () => expect(periodOf(d, 'monthly')).toBe('2026-06'));
    it('yearly → YYYY', () => expect(periodOf(d, 'yearly')).toBe('2026'));
    it('weekly → YYYY-MM-DD', () => expect(periodOf(d, 'weekly')).toBe('2026-06-05'));
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
    it('yearly i번째 = 다음 해', () => {
      const base = utc(2026, 0, 15);
      expect(toDateStr(nthOccurrence(base, { cycle: 'yearly', day: 15 }, 1))).toBe('2027-01-15');
    });
    it('weekly i번째 = +7*i 일', () => {
      const base = utc(2026, 5, 5);
      expect(toDateStr(nthOccurrence(base, { cycle: 'weekly', day: 0 }, 1))).toBe('2026-06-12');
      expect(toDateStr(nthOccurrence(base, { cycle: 'weekly', day: 0 }, 2))).toBe('2026-06-19');
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
