/**
 * 시드 공용 헬퍼.
 * 각 도메인 시드 파일(transactions/savings/investments)이 함께 쓰는 유틸·타입.
 */
import type { PrismaClient } from '@prisma/client';
import { CryptoService } from '@leejinyoung-kr/core-security';
import { cipherContext, type CipherField } from '../../src/crypto/crypto-fields';
import { cryptoOptions } from '../../src/crypto/crypto-options';

// 시드 날짜는 이 날을 '오늘'로 보고 적었다. 실행할 때 이 날과 실제 오늘(KST)의 달 차이만큼 모든 날짜를 옮겨,
// 언제 넣어도 '이번 달' 데이터가 차 있게 한다 (데모는 매일 다시 넣는다)
const AUTHORED_TODAY = '2026-06-10';

const pad = (n: number): string => String(n).padStart(2, '0');

// 오늘(KST) 'YYYY-MM-DD'
export const todayStr: string = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);

const monthIndex = (s: string): number => Number(s.slice(0, 4)) * 12 + Number(s.slice(5, 7)) - 1;
const MONTH_SHIFT = monthIndex(todayStr) - monthIndex(AUTHORED_TODAY);

// 'YYYY-MM-DD' 를 n달 옮긴다 — 그 달에 없는 날(31일 등)은 말일로
export function addMonths(s: string, n: number): string {
  const idx = monthIndex(s) + n;
  const y = Math.floor(idx / 12);
  const m = (idx % 12) + 1;
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${y}-${pad(m)}-${pad(Math.min(Number(s.slice(8, 10)), last))}`;
}

// 시드에 적은 날짜 → 실행일 기준으로 옮긴 'YYYY-MM-DD'
export const ds = (s: string): string => addMonths(s, MONTH_SHIFT);

// 시드에 적은 날짜를 옮긴 뒤 k달 더 — 매월 회차를 만들 때 날을 처음 적은 날 기준으로 유지한다
export const dsPlus = (s: string, k: number): string => addMonths(s, MONTH_SHIFT + k);

// 시드에 적은 달 'YYYY-MM' → 실행일 기준으로 옮긴 달
export const ym = (s: string): string => ds(`${s}-01`).slice(0, 7);

// 'YYYY-MM-DD' → UTC 자정 Date (@db.Date 컬럼용) — 날짜는 실행일 기준으로 옮겨진다
export const d = (s: string): Date => dAt(ds(s));

// 이미 옮긴(또는 inDays 로 만든) 'YYYY-MM-DD' → UTC 자정 Date — 다시 옮기지 않는다
export const dAt = (s: string): Date => new Date(`${s}T00:00:00Z`);

// 시드에 적은 날짜를 옮기되 오늘보다 늦어지면 오늘로 (마지막 사용일처럼 미래일 수 없는 날짜용)
export const dsPast = (s: string): string => (ds(s) > todayStr ? todayStr : ds(s));

// 시드에 적은 결제일을 옮긴 뒤, 오늘보다 이르면 주기(달 수)씩 넘겨 오늘 이후 첫 결제일로 — 날은 처음 적은 날 기준
export function dsNext(s: string, stepMonths: number): string {
  let n = MONTH_SHIFT;
  let out = addMonths(s, n);
  while (out < todayStr) {
    n += stepMonths;
    out = addMonths(s, n);
  }
  return out;
}

// 오늘부터 n일 뒤 'YYYY-MM-DD' (만기 · 체험 종료 임박처럼 오늘과의 간격이 중요한 날짜용)
export function inDays(n: number): string {
  return new Date(Date.parse(`${todayStr}T00:00:00Z`) + n * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

// n일 전 Date (타임스탬프 컬럼용)
export const daysAgo = (n: number): Date => new Date(Date.now() - n * 24 * 60 * 60 * 1000);

// 도메인 시드 함수 시그니처 — 한 사용자에게 더미를 채우고 삽입 건수를 반환
export type SeedFn = (prisma: PrismaClient, userId: number) => Promise<number>;

let crypto: CryptoService | undefined;

// 평문 → 앱과 같은 키링·문맥(필드 + 소유 사용자)의 암호문. 시드 데이터도 앱에서 그대로 복호화된다.
// 키 설정은 앱과 같은 backend/.env(src/config/env.ts 검증) — CRYPTO_KEYS 가 없으면 틀린 키 목록과 함께 멈춘다
export function enc(plain: string, field: CipherField, userId: number): string {
  crypto ??= new CryptoService(cryptoOptions());
  return crypto.encrypt(plain, cipherContext(field, userId));
}
