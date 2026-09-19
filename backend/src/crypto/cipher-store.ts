import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { EncryptedColumn } from './crypto-fields';

export interface CipherRow {
  id: number;
  userId: number;
  value: string;
}

// 암호문 컬럼 읽기·교체 — 재암호화 로직을 DB 없이 테스트하려고 분리한 경계
export interface CipherStore {
  // 값이 있는 행 전부(소프트 삭제 포함 — 남아 있는 한 이전 키를 뺄 수 없다)
  load(col: EncryptedColumn): Promise<CipherRow[]>;
  // 값이 prev 그대로일 때만 next 로 바꾼다. 그 사이 사용자가 고쳤으면 false
  replace(
    col: EncryptedColumn,
    id: number,
    prev: string,
    next: string,
  ): Promise<boolean>;
}

export const CIPHER_STORE = Symbol('CIPHER_STORE');

// raw SQL 구현 — Prisma update 는 @updatedAt 을 갱신해 "최근 수정순" 목록이 재암호화 시각으로 뒤섞이므로 쓰지 않는다.
// 테이블·컬럼 이름은 코드의 고정 목록(ENCRYPTED_COLUMNS)에서만 온다(사용자 입력 아님)
@Injectable()
export class PrismaCipherStore implements CipherStore {
  constructor(private readonly prisma: PrismaService) {}

  // 한 컬럼의 암호문 전부를 id 순으로
  async load(col: EncryptedColumn): Promise<CipherRow[]> {
    const rows = await this.prisma.$queryRawUnsafe<
      { id: number; user_id: number; value: string }[]
    >(
      `SELECT id, user_id, \`${col.column}\` AS value FROM \`${col.table}\` WHERE \`${col.column}\` IS NOT NULL ORDER BY id`,
    );
    return rows.map((r) => ({
      id: Number(r.id),
      userId: Number(r.user_id),
      value: r.value,
    }));
  }

  // compare-and-swap 갱신 — 읽은 뒤 사용자가 값을 바꿨으면 덮어쓰지 않는다
  async replace(
    col: EncryptedColumn,
    id: number,
    prev: string,
    next: string,
  ): Promise<boolean> {
    const count = await this.prisma.$executeRawUnsafe(
      `UPDATE \`${col.table}\` SET \`${col.column}\` = ? WHERE id = ? AND \`${col.column}\` = ?`,
      next,
      id,
      prev,
    );
    return count === 1;
  }
}
