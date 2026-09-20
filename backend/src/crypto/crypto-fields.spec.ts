import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ENCRYPTED_COLUMNS, ENCRYPTED_FIELD_MAP } from './crypto-fields';

const SCHEMA = join(__dirname, '..', '..', 'prisma', 'schema.prisma');

interface SchemaColumn {
  table: string;
  column: string;
  comment: string;
}

// schema.prisma → 컬럼 목록 (테이블명은 @@map 기준, 코멘트는 /// 뒤)
function schemaColumns(): SchemaColumn[] {
  const text = readFileSync(SCHEMA, 'utf8');
  const out: SchemaColumn[] = [];
  for (const [, model, body] of text.matchAll(
    /^model (\w+) \{([\s\S]*?)^\}/gm,
  )) {
    const table = /@@map\("([^"]+)"\)/.exec(body)?.[1] ?? model;
    for (const raw of body.split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith('@@') || line.startsWith('//')) continue;
      const [code, comment = ''] = line.split('///');
      out.push({ table, column: code.trim().split(/\s+/)[0], comment });
    }
  }
  return out;
}

const key = (c: { table: string; column: string }) => `${c.table}.${c.column}`;

// 재암호화·배포 전 점검은 ENCRYPTED_COLUMNS 만 돈다 — 목록에서 빠진 암호문 컬럼은 이전 키를 뺄 때 조용히 깨진다
describe('암호화 컬럼 목록 (crypto-fields)', () => {
  const columns = schemaColumns();

  it('schema.prisma 의 암호문 컬럼(_enc 또는 코멘트에 "암호문")이 전부 목록에 있다', () => {
    const encrypted = columns
      .filter((c) => c.column.endsWith('_enc') || c.comment.includes('암호문'))
      .map(key);
    expect(encrypted.length).toBeGreaterThan(0);
    expect(encrypted.sort()).toEqual(ENCRYPTED_COLUMNS.map(key).sort());
  });

  it('목록의 테이블은 전부 user_id 가 있다 — 문맥(AAD)이 소유 사용자를 담는다', () => {
    const withUser = new Set(
      columns.filter((c) => c.column === 'user_id').map((c) => c.table),
    );
    for (const col of ENCRYPTED_COLUMNS)
      expect(withUser.has(col.table)).toBe(true);
  });
});

// 쓰기 가드(PrismaService 의 $extends)는 이 지도만 본다 — 목록과 어긋나면 평문 저장을 놓친다
describe('쓰기 가드 지도 (ENCRYPTED_FIELD_MAP)', () => {
  it('ENCRYPTED_COLUMNS 의 컬럼을 Prisma 모델명(camelCase)으로 전부 담는다', () => {
    const flat = Object.entries(ENCRYPTED_FIELD_MAP)
      .flatMap(([model, cols]) => cols.map((c) => `${model}.${c}`))
      .sort();
    const expected = ENCRYPTED_COLUMNS.map(
      (c) =>
        `${c.table.replace(/_([a-z])/g, (_m, x: string) => x.toUpperCase())}.${c.column}`,
    ).sort();
    expect(flat).toEqual(expected);
  });

  it('모델명은 snake_case 가 아니다 — Prisma 클라이언트 표기와 맞춰야 가드가 걸린다', () => {
    for (const model of Object.keys(ENCRYPTED_FIELD_MAP)) {
      expect(model).not.toContain('_');
    }
  });
});
