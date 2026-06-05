import { describe, it, expect } from 'vitest';
import { pwStrength, fmtCredDate } from './credential';

describe('pwStrength', () => {
  it('빈 값 → 0% danger', () => {
    expect(pwStrength('')).toEqual({ pct: 0, tone: 'danger', label: '—' });
  });

  it('짧은 비번 → danger', () => {
    expect(pwStrength('abc').tone).toBe('danger');
  });

  it('8자 소문자만 → danger (30%)', () => {
    const r = pwStrength('abcdefgh');
    expect(r.pct).toBe(30);
    expect(r.tone).toBe('danger');
  });

  it('대소문자+숫자 9자 → warning', () => {
    const r = pwStrength('Abcdefgh1');
    expect(r.tone).toBe('warning');
    expect(r.pct).toBeGreaterThanOrEqual(45);
  });

  it('12자+ 대소문자+숫자+특수 → green 100%', () => {
    const r = pwStrength('Abcdefgh1234!');
    expect(r.tone).toBe('green');
    expect(r.pct).toBe(100);
  });
});

describe('fmtCredDate', () => {
  it('ISO → YYYY.MM.DD', () => {
    expect(fmtCredDate('2026-06-05T12:00:00.000Z')).toBe('2026.06.05');
  });
});
