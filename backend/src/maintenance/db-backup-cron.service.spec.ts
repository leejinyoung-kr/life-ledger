import { mkdtemp, readdir, rm, utimes, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { DbBackupCronService, parseDbUrl } from './db-backup-cron.service';

// DATABASE_URL 파싱 + 보관기간(30일) 정리 로직 회귀 테스트.
// mariadb-dump 실행은 외부 바이너리 의존이라 제외하고 순수 로직만 검증.
describe('DbBackupCronService', () => {
  const svc = () => new DbBackupCronService();

  it('DATABASE_URL 을 host/port/user/password/database 로 분해한다', () => {
    const cfg = parseDbUrl('mysql://root:p%40ss@db:3306/docnexus');
    expect(cfg).toEqual({ host: 'db', port: '3306', user: 'root', password: 'p@ss', database: 'docnexus' });
  });

  it('포트 생략 시 3306 으로 기본값 처리한다', () => {
    expect(parseDbUrl('mysql://root:secret@localhost/docnexus').port).toBe('3306');
  });

  describe('purgeOld', () => {
    let dir: string;

    beforeEach(async () => {
      dir = await mkdtemp(join(tmpdir(), 'docnexus-backup-'));
    });

    afterEach(async () => {
      await rm(dir, { recursive: true, force: true });
    });

    it('30일 지난 백업 파일만 삭제하고 최근 파일·다른 파일은 보존한다', async () => {
      const old = join(dir, 'docnexus_2026-01-01.sql.gz');
      const recent = join(dir, 'docnexus_2026-06-10.sql.gz');
      const unrelated = join(dir, 'note.txt');
      await writeFile(old, 'old');
      await writeFile(recent, 'recent');
      await writeFile(unrelated, 'keep');

      const oldTime = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
      await utimes(old, oldTime, oldTime);

      await (svc() as any).purgeOld(dir);

      const left = await readdir(dir);
      expect(left.sort()).toEqual(['docnexus_2026-06-10.sql.gz', 'note.txt']);
    });
  });
});
