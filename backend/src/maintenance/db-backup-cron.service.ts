import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { spawn } from 'child_process';
import { createWriteStream } from 'fs';
import { mkdir, readdir, stat, unlink } from 'fs/promises';
import { join } from 'path';
import { createGzip } from 'zlib';

const RETENTION_DAYS = 30;

// DB 백업 — mariadb-dump 결과를 gzip 압축해 BACKUP_DIR(기본 backend/backups)에 저장.
// 30일 지난 백업은 자동 삭제. 컨테이너 환경에서는 mariadb-client(mariadb-dump)가 설치되어 있어야 한다.
@Injectable()
export class DbBackupCronService {
  private readonly logger = new Logger(DbBackupCronService.name);

  constructor(private config: ConfigService) {}

  // DATABASE_URL 에서 mariadb-dump 접속 정보 추출
  private dbConfig() {
    const url = new URL(this.config.getOrThrow('DATABASE_URL'));
    return {
      host: url.hostname,
      port: url.port || '3306',
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      database: url.pathname.replace(/^\//, ''),
    };
  }

  // 매일 새벽 4시 — mariadb-dump → gzip 저장 + 30일 경과 백업 정리
  @Cron(CronExpression.EVERY_DAY_AT_4AM)
  async backup(): Promise<void> {
    const dir = this.config.get('BACKUP_DIR') || join(process.cwd(), 'backups');
    await mkdir(dir, { recursive: true });

    const date = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10); // KST 날짜
    const filePath = join(dir, `docnexus_${date}.sql.gz`);
    const { host, port, user, password, database } = this.dbConfig();

    try {
      await new Promise<void>((resolve, reject) => {
        const dump = spawn('mariadb-dump', [
          '-h', host,
          '-P', port,
          '-u', user,
          `-p${password}`,
          '--single-transaction',
          '--routines',
          database,
        ]);
        const gzip = createGzip();
        const out = createWriteStream(filePath);

        dump.stdout.pipe(gzip).pipe(out);

        let stderr = '';
        dump.stderr.on('data', (d) => { stderr += d.toString(); });
        dump.on('error', reject);
        dump.on('close', (code) => {
          if (code === 0) resolve();
          else reject(new Error(stderr || `mysqldump exit ${code}`));
        });
        out.on('error', reject);
      });
      this.logger.log(`DB 백업 완료: ${filePath}`);
    } catch (e) {
      this.logger.error(`DB 백업 실패: ${(e as Error).message}`);
      return;
    }

    await this.purgeOld(dir);
  }

  // 30일 지난 백업 파일 삭제
  private async purgeOld(dir: string): Promise<void> {
    const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
    const files = await readdir(dir);
    for (const f of files) {
      if (!f.startsWith('docnexus_') || !f.endsWith('.sql.gz')) continue;
      const full = join(dir, f);
      const info = await stat(full);
      if (info.mtimeMs < cutoff) {
        await unlink(full);
        this.logger.log(`오래된 백업 삭제: ${f}`);
      }
    }
  }
}
