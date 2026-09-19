import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { defineEnv, EnvValidationError } from '@leejinyoun/core-config';
import { env, envOptions, envShape } from './env';

const BACKEND_DIR = join(__dirname, '..', '..');
const SRC_DIR = join(BACKEND_DIR, 'src');

// .env.example → { KEY: 값 }
function readExample(): Record<string, string> {
  const text = readFileSync(join(BACKEND_DIR, '.env.example'), 'utf8');
  const entries = text
    .split(/\r?\n/)
    .map((line) => /^([A-Z0-9_]+)=(.*)$/.exec(line))
    .filter((m): m is RegExpExecArray => m !== null)
    .map((m) => [m[1], m[2].replace(/^"(.*)"$/, '$1')]);
  return Object.fromEntries(entries) as Record<string, string>;
}

// src 아래 .ts 파일(spec 제외) 전체
function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const full = join(dir, d.name);
    if (d.isDirectory()) return sourceFiles(full);
    return d.name.endsWith('.ts') && !d.name.endsWith('.spec.ts') ? [full] : [];
  });
}

// 주석을 지운 코드 — 주석 속 설명 문구는 검사 대상이 아니다
function stripComments(code: string): string {
  return code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

// 테스트 고정값(test/setup-env.ts) 기준의 유효한 입력
function validSource(): Record<string, string | undefined> {
  return Object.fromEntries(
    Object.keys(envShape).map((k) => [k, process.env[k]]),
  );
}

// defineEnv 를 실행해 실패 목록을 돌려준다
function problemsOf(source: Record<string, string | undefined>) {
  try {
    defineEnv(envShape, { ...envOptions, envFile: false, source });
  } catch (e) {
    if (e instanceof EnvValidationError) return e.problems;
    throw e;
  }
  return [];
}

// 부팅 검증 규칙이 실제 설정 파일·코드와 어긋나지 않는지 CI(도커 빌드의 테스트 단계)에서 강제한다
describe('환경변수 스키마 (config/env)', () => {
  it('테스트 고정값으로 검증을 통과한다', () => {
    expect(env.NODE_ENV).toBe('test');
    expect(env.ALLOWED_EMAILS).toEqual(['tester@example.com']);
    expect(env.PORT).toBe(8000);
  });

  it('.env.example 과 스키마의 키 목록이 같다 — 한쪽에만 추가·삭제하면 실패', () => {
    // NODE_ENV 는 런타임(Dockerfile)·jest 가 정하므로 예시 파일에 두지 않는다
    const schemaKeys = Object.keys(envShape).filter((k) => k !== 'NODE_ENV');
    expect(Object.keys(readExample()).sort()).toEqual(schemaKeys.sort());
  });

  it('.env.example 을 그대로 쓰면 부팅이 거부된다 — 시크릿 예시값·빈 필수값', () => {
    const problems = problemsOf(readExample());
    const byKey = new Map(problems.map((p) => [p.key, p.message]));
    for (const key of [
      'JWT_SECRET',
      'JWT_REFRESH_SECRET',
      'JWT_VAULT_SECRET',
      'CRYPTO_KEYS[0].secret',
    ]) {
      expect(byKey.get(key)).toContain('예시 기본값');
    }
    for (const key of [
      'GOOGLE_CLIENT_ID',
      'GOOGLE_CLIENT_SECRET',
      'B2_KEY_ID',
      'B2_ENDPOINT',
    ]) {
      expect(byKey.get(key)).toBe('미설정');
    }
  });

  it('필수 키가 빠지면 틀린 키를 전부 모아 실패한다', () => {
    const source = {
      ...validSource(),
      ALLOWED_EMAILS: '',
      JWT_VAULT_SECRET: undefined,
      JWT_SECRET: 'short',
    };
    expect(problemsOf(source)).toEqual([
      { key: 'JWT_SECRET', message: '32자 이상 필요 (현재 5자)' },
      { key: 'JWT_VAULT_SECRET', message: '미설정' },
      { key: 'ALLOWED_EMAILS', message: '미설정' },
    ]);
  });

  it('용도별 JWT 시크릿이 같으면 실패한다', () => {
    const source = validSource();
    source.JWT_VAULT_SECRET = source.JWT_SECRET;
    expect(problemsOf(source)).toEqual([
      {
        key: 'JWT_VAULT_SECRET',
        message: 'JWT_SECRET 와 같은 값 — 서로 달라야 함',
      },
    ]);
  });

  it('암호화 키는 <키ID>:<32자 이상 시크릿> 쌍 목록 — 틀린 항목을 위치와 함께 알려 주고 값은 출력하지 않는다', () => {
    const short = 'k2:short-secret';
    const problems = problemsOf({
      ...validSource(),
      CRYPTO_KEYS: `k1:${'a'.repeat(40)},no-key-id-${'b'.repeat(40)},${short}`,
    });
    expect(problems).toEqual([
      {
        key: 'CRYPTO_KEYS[1]',
        message:
          '<키ID>:<시크릿> 형식이어야 함 (키ID 는 영문 소문자·숫자 16자 이내)',
      },
      { key: 'CRYPTO_KEYS[2].secret', message: '32자 이상 필요' },
    ]);
    expect(JSON.stringify(problems)).not.toContain('short-secret');
    expect(problemsOf({ ...validSource(), CRYPTO_KEYS: '' })).toEqual([
      { key: 'CRYPTO_KEYS', message: '미설정' },
    ]);
  });

  it('SMTP·VAPID 가 일부만 설정되면 실패한다 — 메일·푸시가 조용히 꺼지는 것 방지', () => {
    const source = {
      ...validSource(),
      SMTP_HOST: 'smtp.gmail.com',
      VAPID_PUBLIC_KEY: 'pub',
    };
    expect(problemsOf(source).map((p) => p.key)).toEqual([
      'SMTP_USER',
      'SMTP_PASS',
      'VAPID_PRIVATE_KEY',
    ]);
  });

  it('process.env·@nestjs/config·dotenv 는 config/env.ts 밖에서 쓰지 않는다 — 스키마가 설정 목록의 유일한 출처', () => {
    const allowed = join(SRC_DIR, 'config', 'env.ts');
    const offenders = sourceFiles(SRC_DIR)
      .filter((f) => f !== allowed)
      .filter((f) =>
        /process\.env|@nestjs\/config|dotenv/.test(
          stripComments(readFileSync(f, 'utf8')),
        ),
      );
    expect(offenders).toEqual([]);
  });
});
