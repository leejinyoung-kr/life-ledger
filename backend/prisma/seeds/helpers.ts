/**
 * 시드 공용 헬퍼.
 * 각 도메인 시드 파일(transactions/savings/investments)이 함께 쓰는 유틸·타입.
 */
import type { PrismaClient } from '@prisma/client';
import { CryptoService } from '@leejinyoun/core-security';
import { cipherContext, type CipherField } from '../../src/crypto/crypto-fields';
import { cryptoOptions } from '../../src/crypto/crypto-options';

// 'YYYY-MM-DD' → UTC 자정 Date (@db.Date 컬럼용)
export const d = (s: string): Date => new Date(`${s}T00:00:00Z`);

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
