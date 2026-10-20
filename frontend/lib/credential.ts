/**
 * 계정 보관함 공통 타입 · 유틸. 카테고리 목록은 코드 관리(credential_cat)에서 읽는다 — credentials/useCredentialCategories.
 * 백엔드 응답 DTO(/credentials)와 1:1 대응한다. 비밀번호/TOTP 원문은 reveal API 로만 받는다.
 */

export interface Credential {
  id: number;
  name: string;
  url: string | null;
  category: string;
  username: string;
  memo: string | null;
  has2fa: boolean;
  hasBackupCodes: boolean;
  passwordChangedAt: string | null; // ISO
  updatedAt: string; // ISO
}

export interface CredentialSecret {
  password: string;
  totp: string | null;
}

export interface BackupCodes {
  codes: string[];
}

export interface TotpCode {
  code: string;
  period: number;
  remaining: number;
}

// 랜덤 비밀번호 생성 — 영대소문자+숫자 기본, 옵션으로 특수문자 포함 (crypto 난수)
export function generatePassword(length = 16, withSymbols = true): string {
  const base = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const symbols = '!@#$%^&*()-_=+[]{}';
  const pool = withSymbols ? base + symbols : base;
  const arr = new Uint32Array(length);
  crypto.getRandomValues(arr);
  return Array.from(arr, (n) => pool[n % pool.length]).join('');
}

// ISO → 'YYYY.MM.DD'
export function fmtCredDate(iso: string): string {
  return iso.slice(0, 10).replace(/-/g, '.');
}

// 비밀번호 강도(0~100) 추정 — 길이·문자종류 기반
export function pwStrength(pw: string): { pct: number; tone: 'danger' | 'warning' | 'green'; label: string } {
  if (!pw) return { pct: 0, tone: 'danger', label: '—' };
  let score = 0;
  if (pw.length >= 8) score += 30;
  if (pw.length >= 12) score += 20;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score += 20;
  if (/\d/.test(pw)) score += 15;
  if (/[^A-Za-z0-9]/.test(pw)) score += 15;
  const pct = Math.min(score, 100);
  if (pct >= 75) return { pct, tone: 'green', label: '강함' };
  if (pct >= 45) return { pct, tone: 'warning', label: '보통 — 12자 이상 + 특수문자 권장' };
  return { pct, tone: 'danger', label: '약함 — 길이·문자 종류를 늘리세요' };
}
