/**
 * 보관함(신원/계정/ENV) 공용 유틸 — 마스킹·날짜 변환.
 */

// 값 끝 keep 글자만 남기고 마스킹 (목록 미리보기용). 빈 값은 빈 문자열
export function maskTail(value: string, keep = 2): string {
  if (!value) return '';
  if (value.length <= keep) return '•'.repeat(value.length);
  return '•'.repeat(Math.min(value.length - keep, 12)) + value.slice(-keep);
}

// 'YYYY-MM-DD' → UTC 자정 Date (@db.Date 컬럼용). 빈 값은 null
export function toDateOrNull(s: string | null | undefined): Date | null {
  return s ? new Date(`${s}T00:00:00Z`) : null;
}

// Date → 'YYYY-MM-DD' (응답용). null 은 null
export function toDateStr(d: Date | null): string | null {
  return d ? d.toISOString().slice(0, 10) : null;
}
