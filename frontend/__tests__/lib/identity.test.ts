import { describe, it, expect } from 'vitest';
import { fmtDate, ddayOf } from '../../lib/identity';

// 오늘 기준 n일 뒤의 YYYY-MM-DD (로컬)
function isoInDays(n: number): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + n);
  const p = (x: number) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

describe('fmtDate', () => {
  it('YYYY-MM-DD → YYYY.MM.DD', () => expect(fmtDate('2026-06-05')).toBe('2026.06.05'));
  it('null → —', () => expect(fmtDate(null)).toBe('—'));
});

describe('ddayOf', () => {
  it('만료일 없음 → D-— (경고 없음)', () => {
    expect(ddayOf(null)).toEqual({ text: 'D-—', warn: false });
  });

  it('30일 후 → D-30, 60일 이내라 경고', () => {
    const r = ddayOf(isoInDays(30));
    expect(r.text).toBe('D-30');
    expect(r.warn).toBe(true);
  });

  it('100일 후 → 경고 없음', () => {
    expect(ddayOf(isoInDays(100)).warn).toBe(false);
  });

  it('오늘 → D-DAY 경고', () => {
    expect(ddayOf(isoInDays(0))).toEqual({ text: 'D-DAY', warn: true });
  });

  it('과거 → 만료됨 경고', () => {
    expect(ddayOf(isoInDays(-5))).toEqual({ text: '만료됨', warn: true });
  });
});
