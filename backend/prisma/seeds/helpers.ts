/**
 * 시드 공용 헬퍼.
 * 각 도메인 시드 파일(transactions/savings/investments)이 함께 쓰는 유틸·타입.
 */
import type { PrismaClient } from '@prisma/client';
import { createCipheriv, createHash, randomBytes } from 'crypto';

// 'YYYY-MM-DD' → UTC 자정 Date (@db.Date 컬럼용)
export const d = (s: string): Date => new Date(`${s}T00:00:00Z`);

// n일 전 Date (타임스탬프 컬럼용)
export const daysAgo = (n: number): Date => new Date(Date.now() - n * 24 * 60 * 60 * 1000);

// 도메인 시드 함수 시그니처 — 한 사용자에게 더미를 채우고 삽입 건수를 반환
export type SeedFn = (prisma: PrismaClient, userId: number) => Promise<number>;

// CREDENTIAL_SECRET → AES-256 키 (CryptoService 와 동일: sha256 32바이트)
function vaultKey(): Buffer | null {
  const secret = process.env.CREDENTIAL_SECRET;
  if (!secret) return null;
  return createHash('sha256').update(secret).digest();
}

// 보관함 암호화 가능 여부 (CREDENTIAL_SECRET 미설정 시 보관함 시드는 건너뜀)
export const canEncrypt = (): boolean => !!process.env.CREDENTIAL_SECRET;

// 평문 → AES-256-GCM 저장 문자열(v1:iv:tag:cipher). CryptoService.encrypt 와 동일 포맷
export function enc(plain: string): string {
  const key = vaultKey();
  if (!key) throw new Error('CREDENTIAL_SECRET 미설정 — 보관함 더미 암호화 불가');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const e = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString('hex')}:${tag.toString('hex')}:${e.toString('hex')}`;
}
