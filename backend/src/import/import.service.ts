import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CryptoService, readCipherHeader } from '@leejinyoung-kr/core-security';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from '../auth/auth-user';
import {
  cipherContext,
  exportContext,
  type CipherField,
} from '../crypto/crypto-fields';

// 복원 결과 요약
export interface RestoreResult {
  imported: number;
  skipped: number;
  errors: string[];
}

// 백업 JSON 의 계정 1건 형태 (export.credentialsJson 과 대응)
interface BackupCredential {
  name?: string;
  url?: string | null;
  category?: string;
  username?: string;
  password_enc?: string;
  totp_enc?: string | null;
  memo?: string | null;
}

@Injectable()
export class ImportService {
  constructor(
    private prisma: PrismaService,
    private crypto: CryptoService,
  ) {}

  // 백업 암호문을 푼다 — 계정 JSON 백업(이메일 문맥) → ZIP 의 원본 행(같은 사용자 id 문맥) 순으로 시도.
  // v1(이전 포맷)은 문맥 없이 읽힌다(CREDENTIAL_SECRET 이 있을 때만). 풀리지 않으면 null
  private unwrap(
    enc: string,
    field: CipherField,
    user: AuthUser,
  ): string | null {
    for (const context of [
      exportContext(field, user.email),
      cipherContext(field, user.id),
    ]) {
      try {
        return this.crypto.decrypt(enc, context);
      } catch {
        // 다음 문맥으로
      }
    }
    return null;
  }

  // 계정 보관함 JSON 백업 복원 — 암호문을 풀어 이 사용자의 저장 문맥으로 다시 암호화해 넣는다.
  // 풀리지 않는 행(다른 계정의 백업, 이 서버에 없는 키, 손상)은 넣지 않고 오류로 돌려준다 —
  // 복호화 안 되는 행이 들어가면 보안 점수처럼 전체를 복호화하는 화면이 통째로 실패한다
  async restoreCredentials(
    user: AuthUser,
    buffer: Buffer,
  ): Promise<RestoreResult> {
    let parsed: unknown;
    try {
      parsed = JSON.parse(buffer.toString('utf8'));
    } catch {
      throw new BadRequestException('JSON 파일을 읽을 수 없습니다.');
    }

    // { credentials: [...] } 또는 배열 자체 허용
    const list: BackupCredential[] = Array.isArray(parsed)
      ? (parsed as BackupCredential[])
      : ((parsed as { credentials?: BackupCredential[] })?.credentials ?? []);
    if (!Array.isArray(list) || list.length === 0) {
      throw new BadRequestException(
        '복원할 계정 데이터가 없습니다. (credentials 배열 필요)',
      );
    }

    // 기존 계정 (name|username) 집합 — 반복 업로드 시 중복 삽입 방지(멱등성)
    const existing = await this.prisma.credential.findMany({
      where: { user_id: user.id },
      select: { name: true, username: true },
    });
    const seen = new Set(existing.map((e) => `${e.name} ${e.username}`));

    const valid: Prisma.CredentialCreateManyInput[] = [];
    const errors: string[] = [];
    let skipped = 0;

    list.forEach((c, i) => {
      const name = c.name?.trim();
      const username = c.username?.trim();
      const enc = c.password_enc;
      if (!name || !username || !enc) {
        skipped++;
        return;
      }
      const row = `${i + 1}행 '${name}'`;
      // 암호문 형식 검증 — 평문/손상 데이터 차단. 2FA 가 깨졌을 때 조용히 빼면 2FA 없이 복원되므로 행 전체를 오류로 본다
      if (
        !readCipherHeader(enc) ||
        (c.totp_enc && !readCipherHeader(c.totp_enc))
      ) {
        errors.push(`${row}: 암호문 형식 오류 (동일 백업 파일인지 확인)`);
        skipped++;
        return;
      }
      // 이미 존재하거나 같은 파일 내 중복인 (name|username) 은 건너뜀
      const dedupKey = `${name} ${username}`;
      if (seen.has(dedupKey)) {
        skipped++;
        return;
      }
      const password = this.unwrap(enc, 'credential.password_enc', user);
      const totp = c.totp_enc
        ? this.unwrap(c.totp_enc, 'credential.totp_enc', user)
        : null;
      if (password === null || (c.totp_enc && totp === null)) {
        errors.push(
          `${row}: 복호화 실패 — 다른 계정의 백업이거나 백업에 쓰인 키가 이 서버에 없음`,
        );
        skipped++;
        return;
      }
      seen.add(dedupKey);
      valid.push({
        user_id: user.id,
        name,
        url: c.url || null,
        category: c.category || '기타',
        username,
        password_enc: this.crypto.encrypt(
          password,
          cipherContext('credential.password_enc', user.id),
        ),
        totp_enc:
          totp === null
            ? null
            : this.crypto.encrypt(
                totp,
                cipherContext('credential.totp_enc', user.id),
              ),
        password_changed_at: new Date(),
        memo: c.memo || null,
      });
    });

    const CHUNK = 500;
    for (let i = 0; i < valid.length; i += CHUNK) {
      await this.prisma.credential.createMany({
        data: valid.slice(i, i + CHUNK),
      });
    }
    return { imported: valid.length, skipped, errors };
  }
}
