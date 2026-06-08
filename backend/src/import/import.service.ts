import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

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
  constructor(private prisma: PrismaService) {}

  // 계정 보관함 JSON 백업 복원 — 비밀번호/TOTP 는 암호문(v1:...) 그대로 삽입.
  // 동일한 CREDENTIAL_SECRET 환경에서만 복호화되므로 여기선 복호화하지 않고 보존만 한다.
  async restoreCredentials(userId: number, buffer: Buffer): Promise<RestoreResult> {
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
      throw new BadRequestException('복원할 계정 데이터가 없습니다. (credentials 배열 필요)');
    }

    const valid: Prisma.CredentialCreateManyInput[] = [];
    const errors: string[] = [];
    let skipped = 0;

    list.forEach((c, i) => {
      const name = c.name?.trim();
      const username = c.username?.trim();
      const enc = c.password_enc;
      // 암호문 형식(v1:iv:tag:cipher) 검증 — 평문/손상 데이터 차단
      if (!name || !username || !enc) { skipped++; return; }
      if (!/^v1:[0-9a-f]+:[0-9a-f]+:[0-9a-f]+$/i.test(enc)) {
        errors.push(`${i + 1}행 '${name}': 암호문 형식 오류 (동일 백업 파일인지 확인)`);
        skipped++;
        return;
      }
      valid.push({
        user_id: userId,
        name,
        url: c.url || null,
        category: c.category || '기타',
        username,
        password_enc: enc,
        totp_enc: c.totp_enc && /^v1:/i.test(c.totp_enc) ? c.totp_enc : null,
        password_changed_at: new Date(),
        memo: c.memo || null,
      });
    });

    const CHUNK = 500;
    for (let i = 0; i < valid.length; i += CHUNK) {
      await this.prisma.credential.createMany({ data: valid.slice(i, i + CHUNK) });
    }
    return { imported: valid.length, skipped, errors };
  }
}
