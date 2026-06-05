import { maskTail, toDateOrNull, toDateStr } from './vault.util';

describe('vault.util', () => {
  describe('maskTail', () => {
    it('끝 keep 글자만 남기고 마스킹', () => {
      expect(maskTail('1234567', 2)).toBe('•••••67');
    });
    it('길이 ≤ keep 이면 전부 마스킹', () => {
      expect(maskTail('12', 2)).toBe('••');
      expect(maskTail('1', 2)).toBe('•');
    });
    it('마스킹 점은 최대 12개로 제한', () => {
      const out = maskTail('1'.repeat(50), 2);
      expect(out).toBe('•'.repeat(12) + '11');
    });
    it('빈 값은 빈 문자열', () => {
      expect(maskTail('', 2)).toBe('');
    });
  });

  describe('toDateOrNull', () => {
    it('YYYY-MM-DD → UTC 자정 Date', () => {
      const d = toDateOrNull('2026-06-05');
      expect(d?.toISOString()).toBe('2026-06-05T00:00:00.000Z');
    });
    it('빈 값/undefined → null', () => {
      expect(toDateOrNull('')).toBeNull();
      expect(toDateOrNull(null)).toBeNull();
      expect(toDateOrNull(undefined)).toBeNull();
    });
  });

  describe('toDateStr', () => {
    it('Date → YYYY-MM-DD', () => {
      expect(toDateStr(new Date('2026-06-05T12:34:00Z'))).toBe('2026-06-05');
    });
    it('null → null', () => {
      expect(toDateStr(null)).toBeNull();
    });
  });
});
