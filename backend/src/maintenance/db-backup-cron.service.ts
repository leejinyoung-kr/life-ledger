import { Injectable, Logger } from '@nestjs/common';
import { Job } from '@leejinyoung-kr/core-jobs';
import type { JobContext } from '@leejinyoung-kr/core-jobs';
import { spawn } from 'child_process';
import { createWriteStream } from 'fs';
import { mkdir, readdir, stat, unlink } from 'fs/promises';
import { basename, join } from 'path';
import { pipeline } from 'stream/promises';
import { createGzip } from 'zlib';
import { env } from '../config/env';

const RETENTION_DAYS = 30;
// 백업 파일 이름 접두사. 2026-10-15 DB 이름을 바꾸기 전 덤프는 docnexus_ 로 남아 있어 보관 기간 정리에 같이 넣는다
const BACKUP_PREFIX = 'lifeledger_';
const PURGE_PREFIXES = [BACKUP_PREFIX, 'docnexus_'];

// DATABASE_URL 에서 mariadb-dump 접속 정보 추출
export function parseDbUrl(databaseUrl: string) {
  const url = new URL(databaseUrl);
  return {
    host: url.hostname,
    port: url.port || '3306',
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, ''),
  };
}

// DB 백업 — mariadb-dump 결과를 gzip 압축해 BACKUP_DIR(기본 backend/backups)에 저장.
// 30일 지난 백업은 자동 삭제. 컨테이너 환경에서는 mariadb-client(mariadb-dump)가 설치되어 있어야 한다.
@Injectable()
export class DbBackupCronService {
  private readonly logger = new Logger(DbBackupCronService.name);

  // 매일 새벽 4시 — mariadb-dump → gzip 저장 + 30일 경과 백업 정리.
  // 실패하면 쓰다 만 파일을 지우고 던진다(정상 백업처럼 남지 않게). lease 가 끝나면 signal 로 mariadb-dump 도 끝낸다
  @Job({ name: 'db-backup', cron: '0 4 * * *', leaseMs: 30 * 60_000 })
  async backup(ctx: JobContext): Promise<string> {
    const dir = env.BACKUP_DIR ?? join(process.cwd(), 'backups');
    await mkdir(dir, { recursive: true });

    const date = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10); // KST 날짜
    const filePath = join(dir, `${BACKUP_PREFIX}${date}.sql.gz`);
    const { host, port, user, password, database } = parseDbUrl(
      env.DATABASE_URL,
    );

    try {
      const dump = spawn('mariadb-dump', [
        '-h', host,
        '-P', port,
        '-u', user,
        `-p${password}`,
        '--single-transaction',
        '--routines',
        database,
      ], { signal: ctx.signal });
      let stderr = '';
      dump.stderr.on('data', (d) => { stderr += d.toString(); });
      const exited = new Promise<void>((resolve, reject) => {
        dump.on('error', reject);
        dump.on('close', (code) => {
          if (code === 0) resolve();
          else reject(new Error(stderr.trim() || `mariadb-dump exit ${code}`));
        });
      });
      // 파일까지 다 써진 뒤에 성공으로 본다(프로세스 종료만 보면 gzip 끝부분이 덜 써질 수 있다)
      await Promise.all([pipeline(dump.stdout, createGzip(), createWriteStream(filePath)), exited]);
    } catch (e) {
      await unlink(filePath).catch(() => undefined);
      throw e;
    }

    const { size } = await stat(filePath);
    const removed = await this.purgeOld(dir);
    return `${basename(filePath)} (${(size / 1024 / 1024).toFixed(1)}MB)${removed ? `, 오래된 백업 ${removed}개 삭제` : ''}`;
  }

  // 30일 지난 백업 파일 삭제 — 지운 개수를 돌려준다
  private async purgeOld(dir: string): Promise<number> {
    const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
    const files = await readdir(dir);
    let removed = 0;
    for (const f of files) {
      if (!PURGE_PREFIXES.some((p) => f.startsWith(p)) || !f.endsWith('.sql.gz')) continue;
      const full = join(dir, f);
      const info = await stat(full);
      if (info.mtimeMs < cutoff) {
        await unlink(full);
        removed++;
        this.logger.log(`오래된 백업 삭제: ${f}`);
      }
    }
    return removed;
  }
}
