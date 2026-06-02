/**
 * 시드 공용 헬퍼.
 * 각 도메인 시드 파일(transactions/savings/investments)이 함께 쓰는 유틸·타입.
 */
import type { PrismaClient } from '@prisma/client';

// 'YYYY-MM-DD' → UTC 자정 Date (@db.Date 컬럼용)
export const d = (s: string): Date => new Date(`${s}T00:00:00Z`);

// 도메인 시드 함수 시그니처 — 한 사용자에게 더미를 채우고 삽입 건수를 반환
export type SeedFn = (prisma: PrismaClient, userId: number) => Promise<number>;
