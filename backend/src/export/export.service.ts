import { Injectable } from '@nestjs/common';
import AdmZip from 'adm-zip';
import { CryptoService } from '@leejinyoung-kr/core-security';
import { PrismaService } from '../prisma/prisma.service';
import { AccessLogService } from '../access-log/access-log.service';
import type { ClientInfo } from '@leejinyoung-kr/core-logging';
import type { AuthUser } from '../auth/auth-user';
import {
  cipherContext,
  exportContext,
  type CipherField,
} from '../crypto/crypto-fields';

@Injectable()
export class ExportService {
  constructor(
    private prisma: PrismaService,
    private accessLog: AccessLogService,
    private crypto: CryptoService,
  ) {}

  // 계정 보관함 JSON 백업 — 비밀번호/TOTP 는 평문으로 풀지 않고 암호문으로 담는다.
  // 저장 암호문은 사용자 id 문맥에 묶여 있어(DB 를 다시 만들면 id 가 바뀜) 계정 이메일 문맥으로 다시 감싼다
  // → 같은 계정으로, 이 서버의 암호화 키가 남아 있는 동안 복원된다(import.service)
  async credentialsJson(user: AuthUser, client?: ClientInfo) {
    await this.accessLog.log(
      user.id,
      'data_export',
      { type: 'account', id: user.id, name: 'export:credentials' },
      client,
    );
    const rows = await this.prisma.credential.findMany({
      where: { user_id: user.id, deleted_at: null },
      orderBy: { id: 'asc' },
    });
    const rewrap = (enc: string, field: CipherField) =>
      this.crypto.encrypt(
        this.crypto.decrypt(enc, cipherContext(field, user.id)),
        exportContext(field, user.email),
      );
    return {
      exportedAt: new Date().toISOString(),
      note: '비밀번호/TOTP 는 AES-256-GCM 암호문입니다. 같은 계정(이메일)으로, 이 서버의 암호화 키가 남아 있는 동안만 복원됩니다.',
      count: rows.length,
      credentials: rows.map((c) => ({
        name: c.name,
        url: c.url,
        category: c.category,
        username: c.username,
        password_enc: rewrap(c.password_enc, 'credential.password_enc'),
        totp_enc: c.totp_enc ? rewrap(c.totp_enc, 'credential.totp_enc') : null,
        memo: c.memo,
        createdAt: c.created_at.toISOString(),
      })),
    };
  }

  // 전체 데이터 백업 ZIP — 도메인별 JSON.
  // 암호화 컬럼은 암호문 그대로 포함(복호화하지 않음).
  async backupZip(userId: number, client?: ClientInfo): Promise<Buffer> {
    await this.accessLog.log(userId, 'data_export', { type: 'account', id: userId, name: 'export:backup' }, client);
    const where = { where: { user_id: userId, deleted_at: null } };
    const [
      transactions, savings, investments, subscriptions,
      calendarEvents, notifications, securityRisks,
      categories, identityCards, credentials, envProjects, envVars,
      settings,
    ] = await this.prisma.$transaction([
      this.prisma.transaction.findMany(where),
      this.prisma.saving.findMany(where),
      this.prisma.investment.findMany(where),
      this.prisma.subscription.findMany(where),
      this.prisma.calendarEvent.findMany(where),
      this.prisma.notification.findMany({ where: { user_id: userId } }),
      this.prisma.securityRisk.findMany({ where: { user_id: userId } }),
      this.prisma.category.findMany(), // 전역 공용 분류표 스냅샷 (user 무관)
      this.prisma.identityCard.findMany(where),
      this.prisma.credential.findMany(where),
      this.prisma.envProject.findMany(where),
      this.prisma.envVar.findMany(where),
      this.prisma.userSettings.findUnique({ where: { user_id: userId } }),
    ]);

    const zip = new AdmZip();
    const json = (v: unknown) => Buffer.from(JSON.stringify(v, null, 2), 'utf8');

    // 도메인별 JSON
    const data: Record<string, unknown> = {
      transactions, savings, investments, subscriptions,
      calendarEvents, notifications, securityRisks,
      categories, identityCards, credentials, envProjects, envVars,
      settings,
    };
    for (const [name, rows] of Object.entries(data)) {
      zip.addFile(`data/${name}.json`, json(rows));
    }

    // 안내
    zip.addFile(
      'README.txt',
      Buffer.from(
        [
          'DocNexus 데이터 백업',
          `생성: ${new Date().toISOString()}`,
          '',
          '- data/ : 도메인별 전체 데이터(JSON)',
          '- 계정 비밀번호·신원 번호·ENV 값은 AES-256-GCM 암호문(v2:<키ID>:...)으로 포함됩니다.',
          '  이 서버에 해당 키가 남아 있는 동안만 복호화할 수 있습니다. 계정 보관함 복원에는 계정 JSON 백업을 쓰세요.',
        ].join('\n'),
        'utf8',
      ),
    );

    return zip.toBuffer();
  }
}
