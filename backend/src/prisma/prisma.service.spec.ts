import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const BACKEND_DIR = join(__dirname, '..', '..');

// 디렉터리 아래 .ts 파일(spec 제외) 전체
function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const full = join(dir, d.name);
    if (d.isDirectory()) return sourceFiles(full);
    return d.name.endsWith('.ts') && !d.name.endsWith('.spec.ts') ? [full] : [];
  });
}

// DB 시각은 KST 벽시계로 저장한다 (infra ADR 0008) — 하나라도 감싸지 않은 연결이 있으면 UTC 가 섞인다
describe('DB 연결 (prisma)', () => {
  it('어댑터를 만드는 곳마다 withKstDateTime 으로 감싼다 — 앱 · 시드 · 데모 초기화 · 스크립트', () => {
    const files = ['src', 'prisma', 'scripts'].flatMap((d) =>
      sourceFiles(join(BACKEND_DIR, d)),
    );
    const made = files.filter((f) =>
      readFileSync(f, 'utf8').includes('new PrismaMariaDb('),
    );
    const unwrapped = made.filter((f) => {
      const code = readFileSync(f, 'utf8');
      return (
        code.split('new PrismaMariaDb(').length !==
        code.split('withKstDateTime(new PrismaMariaDb(').length
      );
    });
    expect(made.length).toBeGreaterThan(0);
    expect(unwrapped).toEqual([]);
  });
});
