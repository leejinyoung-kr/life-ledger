import { Injectable } from '@nestjs/common';
import AdmZip from 'adm-zip';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ExportService {
  constructor(private prisma: PrismaService) {}

  // 계정 보관함 JSON 백업 — 비밀번호/TOTP 는 암호문(v1:...) 그대로 보존.
  // 복원은 동일한 CREDENTIAL_SECRET 환경에서만 복호화 가능하다.
  async credentialsJson(userId: number) {
    const rows = await this.prisma.credential.findMany({
      where: { user_id: userId, deleted_at: null },
      orderBy: { id: 'asc' },
    });
    return {
      exportedAt: new Date().toISOString(),
      note: '비밀번호/TOTP 는 AES-256-GCM 암호문입니다. 동일한 CREDENTIAL_SECRET 으로만 복호화됩니다.',
      count: rows.length,
      credentials: rows.map((c) => ({
        name: c.name,
        emoji: c.emoji,
        url: c.url,
        category: c.category,
        username: c.username,
        password_enc: c.password_enc,
        totp_enc: c.totp_enc,
        memo: c.memo,
        createdAt: c.created_at.toISOString(),
      })),
    };
  }

  // 전체 데이터 백업 ZIP — 도메인별 JSON + 메모 마크다운.
  // 암호화 컬럼은 암호문 그대로 포함(복호화하지 않음).
  async backupZip(userId: number): Promise<Buffer> {
    const where = { where: { user_id: userId, deleted_at: null } };
    const [
      transactions, savings, investments, subscriptions, assets,
      tasks, goals, calendarEvents, notifications, securityRisks,
      categories, identityCards, credentials, envProjects, envVars,
      notes, settings,
    ] = await this.prisma.$transaction([
      this.prisma.transaction.findMany(where),
      this.prisma.saving.findMany(where),
      this.prisma.investment.findMany(where),
      this.prisma.subscription.findMany(where),
      this.prisma.asset.findMany(where),
      this.prisma.task.findMany(where),
      this.prisma.goal.findMany(where),
      this.prisma.calendarEvent.findMany(where),
      this.prisma.notification.findMany({ where: { user_id: userId } }),
      this.prisma.securityRisk.findMany(where),
      this.prisma.category.findMany({ where: { user_id: userId } }),
      this.prisma.identityCard.findMany(where),
      this.prisma.credential.findMany(where),
      this.prisma.envProject.findMany(where),
      this.prisma.envVar.findMany(where),
      this.prisma.note.findMany(where),
      this.prisma.userSettings.findUnique({ where: { user_id: userId } }),
    ]);

    const zip = new AdmZip();
    const json = (v: unknown) => Buffer.from(JSON.stringify(v, null, 2), 'utf8');

    // 도메인별 JSON
    const data: Record<string, unknown> = {
      transactions, savings, investments, subscriptions, assets,
      tasks, goals, calendarEvents, notifications, securityRisks,
      categories, identityCards, credentials, envProjects, envVars,
      notes, settings,
    };
    for (const [name, rows] of Object.entries(data)) {
      zip.addFile(`data/${name}.json`, json(rows));
    }

    // 메모 → 개별 마크다운 파일
    for (const n of notes) {
      const safe = n.title.replace(/[\\/:*?"<>|]/g, '_').slice(0, 60) || 'note';
      zip.addFile(`notes/${n.id}_${safe}.md`, Buffer.from(`# ${n.title}\n\n${n.body}\n`, 'utf8'));
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
          '- notes/ : 메모 마크다운',
          '- 계정 비밀번호·신원 번호·ENV 값은 AES-256-GCM 암호문(v1:...)으로 포함됩니다.',
          '  동일한 CREDENTIAL_SECRET 환경에서만 복호화할 수 있습니다.',
        ].join('\n'),
        'utf8',
      ),
    );

    return zip.toBuffer();
  }
}
