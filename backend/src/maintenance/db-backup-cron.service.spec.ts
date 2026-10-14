import { EventEmitter } from 'events';
import { existsSync } from 'fs';
import { mkdtemp, readdir, readFile, rm, utimes, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { PassThrough } from 'stream';
import { gunzipSync } from 'zlib';
import { spawn } from 'child_process';
import type { JobContext } from '@leejinyoung-kr/core-jobs';
import { DbBackupCronService, parseDbUrl } from './db-backup-cron.service';

// env 는 동결 객체라 모듈째 바꾼다 — getter 로 두어 테스트마다 BACKUP_DIR 을 바꿀 수 있게
const mockEnv: { BACKUP_DIR?: string; DATABASE_URL: string } = {
  DATABASE_URL: 'mysql://root:secret@db:3306/lifeledger',
};
jest.mock('../config/env', () => ({
  get env() {
    return mockEnv;
  },
}));
jest.mock('child_process', () => ({
  ...jest.requireActual<typeof import('child_process')>('child_process'),
  spawn: jest.fn(),
}));

// mariadb-dump 대역 — stdout 으로 덤프를 흘리고 exitCode 로 끝난다
function fakeDump(exitCode: number, stdout: string, stderr = '') {
  const child = Object.assign(new EventEmitter(), {
    stdout: new PassThrough(),
    stderr: new PassThrough(),
  });
  // close 는 stdout 을 다 읽은 뒤에 낸다 — 서비스가 리스너를 붙이기 전에 close 가 먼저 나면
  // 종료 코드를 놓쳐 테스트가 간헐적으로 실패한다(실제 자식 프로세스도 이 순서로 끝난다)
  child.stdout.on('end', () => setImmediate(() => child.emit('close', exitCode)));
  setImmediate(() => {
    child.stderr.end(stderr);
    child.stdout.end(stdout);
  });
  return child;
}

// DATABASE_URL 파싱 + 보관기간(30일) 정리 + 덤프 성공·실패 처리 회귀 테스트.
// mariadb-dump 는 외부 바이너리라 spawn 을 대역으로 바꿔 검증한다
describe('DbBackupCronService', () => {
  const svc = () => new DbBackupCronService();
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'lifeledger-backup-'));
    mockEnv.BACKUP_DIR = dir;
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
    jest.mocked(spawn).mockReset();
  });

  it('DATABASE_URL 을 host/port/user/password/database 로 분해한다', () => {
    const cfg = parseDbUrl('mysql://root:p%40ss@db:3306/lifeledger');
    expect(cfg).toEqual({ host: 'db', port: '3306', user: 'root', password: 'p@ss', database: 'lifeledger' });
  });

  it('포트 생략 시 3306 으로 기본값 처리한다', () => {
    expect(parseDbUrl('mysql://root:secret@localhost/lifeledger').port).toBe('3306');
  });

  describe('backup', () => {
    const ctx = () => ({ signal: new AbortController().signal }) as JobContext;

    it('덤프를 gzip 파일로 남기고 요약을 돌려준다 — lease signal 을 mariadb-dump 에 넘긴다', async () => {
      jest.mocked(spawn).mockImplementation(() => fakeDump(0, 'CREATE TABLE t;') as never);
      const c = ctx();
      const summary = await svc().backup(c);

      const [file] = await readdir(dir);
      expect(file).toMatch(/^lifeledger_\d{4}-\d{2}-\d{2}\.sql\.gz$/);
      expect(gunzipSync(await readFile(join(dir, file))).toString()).toBe('CREATE TABLE t;');
      expect(summary).toMatch(new RegExp(`^${file.replace(/\./g, '\\.')} \\(\\d+\\.\\dMB\\)$`));
      expect(jest.mocked(spawn).mock.calls[0][2]).toEqual({ signal: c.signal });
    });

    it('mariadb-dump 가 실패하면 쓰다 만 파일을 지우고 원본 에러(stderr)로 던진다', async () => {
      jest.mocked(spawn).mockImplementation(() => fakeDump(2, 'partial', 'Access denied for user') as never);
      await expect(svc().backup(ctx())).rejects.toThrow('Access denied for user');
      expect(await readdir(dir)).toEqual([]);
    });
  });

  describe('purgeOld', () => {
    it('30일 지난 백업 파일만 삭제하고 최근 파일·다른 파일은 보존한다 — 옛 이름(docnexus_) 덤프도 정리한다', async () => {
      const old = join(dir, 'lifeledger_2026-01-01.sql.gz');
      const oldLegacy = join(dir, 'docnexus_2026-01-02.sql.gz');
      const recent = join(dir, 'lifeledger_2026-06-10.sql.gz');
      const unrelated = join(dir, 'note.txt');
      await writeFile(old, 'old');
      await writeFile(oldLegacy, 'old');
      await writeFile(recent, 'recent');
      await writeFile(unrelated, 'keep');

      const oldTime = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
      await utimes(old, oldTime, oldTime);
      await utimes(oldLegacy, oldTime, oldTime);

      expect(await (svc() as any).purgeOld(dir)).toBe(2);

      const left = await readdir(dir);
      expect(left.sort()).toEqual(['lifeledger_2026-06-10.sql.gz', 'note.txt']);
      expect(existsSync(old)).toBe(false);
      expect(existsSync(oldLegacy)).toBe(false);
    });
  });
});
