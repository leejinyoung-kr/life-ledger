import {
  CryptoService,
  type CryptoModuleOptions,
} from '@leejinyoung-kr/core-security';
import type { CipherRow, CipherStore } from './cipher-store';
import {
  brokenKeys,
  CryptoAuditService,
  formatReports,
} from './crypto-audit.service';
import { CryptoBootstrapService } from './crypto-bootstrap.service';
import { cipherContext, type EncryptedColumn } from './crypto-fields';
import { v1Encrypt } from '../../test/v1-cipher';

const LEGACY = 'legacy-credential-secret-0123456789abcdef';
const OLD = { id: 'k2609', secret: 'old-crypto-key-0123456789abcdef-0123' };
const NEW = { id: 'k2612', secret: 'new-crypto-key-0123456789abcdef-0123' };

// 컬럼별 행을 메모리에 두는 가짜 저장소 — replace 는 실제 구현처럼 값이 그대로일 때만 바꾼다
class MemoryStore implements CipherStore {
  private readonly data = new Map<string, CipherRow[]>();
  // replace 직전에 끼어드는 사용자 수정 흉내
  beforeReplace?: (label: string, row: CipherRow) => void;

  constructor(seed: Record<string, CipherRow[]>) {
    for (const [label, rows] of Object.entries(seed))
      this.data.set(label, rows);
  }

  rows(label: string): CipherRow[] {
    return this.data.get(label) ?? [];
  }

  load(col: EncryptedColumn): Promise<CipherRow[]> {
    return Promise.resolve(
      this.rows(`${col.table}.${col.column}`).map((r) => ({ ...r })),
    );
  }

  replace(
    col: EncryptedColumn,
    id: number,
    prev: string,
    next: string,
  ): Promise<boolean> {
    const label = `${col.table}.${col.column}`;
    const row = this.rows(label).find((r) => r.id === id);
    if (row) this.beforeReplace?.(label, row);
    if (!row || row.value !== prev) return Promise.resolve(false);
    row.value = next;
    return Promise.resolve(true);
  }
}

const crypto = (options: Partial<CryptoModuleOptions>) =>
  new CryptoService({ keys: [NEW], currentKeyId: NEW.id, ...options });
const PW = (userId: number) => cipherContext('credential.password_enc', userId);
const KEY = (userId: number) =>
  cipherContext('userSettings.openai_api_key', userId);

// 재암호화 이전 DB — v1 행, 이전 키(k2609) 행, 평문 OpenAI 키
function legacyStore(): MemoryStore {
  const before = crypto({ keys: [OLD], currentKeyId: OLD.id });
  return new MemoryStore({
    'credential.password_enc': [
      { id: 1, userId: 1, value: v1Encrypt('v1-pw', LEGACY) },
      { id: 2, userId: 1, value: before.encrypt('old-key-pw', PW(1)) },
      { id: 3, userId: 2, value: v1Encrypt('', LEGACY) },
    ],
    'user_settings.openai_api_key': [
      { id: 1, userId: 1, value: 'sk-proj-plaintext' },
    ],
  });
}

describe('CryptoAuditService — 점검·재암호화', () => {
  it('v1·이전 키·평문을 현재 키로 재암호화하고, 이전 키와 legacy 를 빼도 전부 같은 값으로 읽힌다', async () => {
    const store = legacyStore();
    const rotating = crypto({ keys: [NEW, OLD], legacySecret: LEGACY });
    const audit = new CryptoAuditService(store, rotating);

    const before = await audit.verify();
    const pw = before.find((r) => r.label === 'credential.password_enc');
    expect(pw).toMatchObject({
      total: 3,
      byKey: { v1: 2, k2609: 1 },
      stale: 3,
      failures: [],
    });
    expect(
      before.find((r) => r.label === 'user_settings.openai_api_key'),
    ).toMatchObject({ byKey: { 평문: 1 }, stale: 1 });

    const results = await audit.reencrypt();
    expect(results.reduce((n, r) => n + r.converted, 0)).toBe(4);
    expect(
      results.every((r) => r.failures.length === 0 && r.conflicts === 0),
    ).toBe(true);

    // 이전 키·legacy 제거 후
    const after = crypto({});
    const [a, b, c] = store.rows('credential.password_enc');
    expect(after.decrypt(a.value, PW(1))).toBe('v1-pw');
    expect(after.decrypt(b.value, PW(1))).toBe('old-key-pw');
    expect(after.decrypt(c.value, PW(2))).toBe('');
    expect(
      after.decrypt(
        store.rows('user_settings.openai_api_key')[0].value,
        KEY(1),
      ),
    ).toBe('sk-proj-plaintext');

    const verified = await new CryptoAuditService(store, after).verify();
    expect(
      verified.every((r) => r.failures.length === 0 && r.stale === 0),
    ).toBe(true);
    expect(
      verified.find((r) => r.label === 'credential.password_enc')?.byKey,
    ).toEqual({ k2612: 3 });
  });

  it('재암호화는 사용자 문맥으로 묶는다 — 다른 사용자 문맥으로는 풀리지 않는다', async () => {
    const store = legacyStore();
    await new CryptoAuditService(
      store,
      crypto({ keys: [NEW, OLD], legacySecret: LEGACY }),
    ).reencrypt();
    const [first] = store.rows('credential.password_enc');
    expect(() => crypto({}).decrypt(first.value, PW(2))).toThrow(
      '복호화에 실패',
    );
  });

  it('설정에 없는 키로 된 암호문은 missing-key 로 보고하고 건드리지 않는다 (키를 너무 일찍 뺀 경우)', async () => {
    const store = legacyStore();
    const original = store.rows('credential.password_enc').map((r) => r.value);
    const audit = new CryptoAuditService(store, crypto({}));

    const [pw] = await audit.verify();
    expect(pw.failures.map((f) => [f.id, f.kind, f.reason])).toEqual([
      [1, 'missing-key', 'v1 암호문인데 CREDENTIAL_SECRET 이 없음'],
      [2, 'missing-key', '키 k2609 가 CRYPTO_KEYS 에 없음'],
      [3, 'missing-key', 'v1 암호문인데 CREDENTIAL_SECRET 이 없음'],
    ]);
    await audit.reencrypt();
    expect(store.rows('credential.password_enc').map((r) => r.value)).toEqual(
      original,
    );
  });

  it('평문은 평문 레거시가 허용된 컬럼(OpenAI 키)에서만 받는다 — 다른 컬럼의 평문은 형식 오류', async () => {
    const store = new MemoryStore({
      'credential.password_enc': [
        { id: 9, userId: 1, value: 'plain-password' },
      ],
    });
    const audit = new CryptoAuditService(store, crypto({}));
    const [pw] = await audit.verify();
    expect(pw.failures).toEqual([
      {
        id: 9,
        key: '형식 오류',
        kind: 'invalid',
        reason: '암호문 형식이 아님',
      },
    ]);
    await audit.reencrypt();
    expect(store.rows('credential.password_enc')[0].value).toBe(
      'plain-password',
    );
  });

  it('verify 는 실제로 복호화한다 — 키 ID 는 맞지만 시크릿을 잘못 넣은 경우까지 잡는다', async () => {
    const store = new MemoryStore({
      'credential.password_enc': [
        { id: 1, userId: 1, value: crypto({}).encrypt('pw', PW(1)) },
      ],
    });
    const wrong = crypto({
      keys: [{ id: NEW.id, secret: 'typo-crypto-key-0123456789abcdef-012' }],
    });
    const reports = await new CryptoAuditService(store, wrong).verify();
    expect(reports[0].failures).toEqual([
      {
        id: 1,
        key: 'k2612',
        kind: 'decrypt',
        reason:
          '복호화에 실패했습니다 — 키·문맥이 맞지 않거나 변조된 암호문입니다.',
      },
    ]);
    expect(brokenKeys(reports)).toEqual(['k2612']);
  });

  it('다른 사용자 행으로 옮겨진 암호문은 재암호화하지 않고 실패로 남긴다', async () => {
    const before = crypto({ keys: [OLD], currentKeyId: OLD.id });
    const moved = before.encrypt('victim-pw', PW(1));
    const store = new MemoryStore({
      'credential.password_enc': [{ id: 5, userId: 2, value: moved }],
    });
    const [pw] = await new CryptoAuditService(
      store,
      crypto({ keys: [NEW, OLD] }),
    ).reencrypt();
    expect(pw.converted).toBe(0);
    expect(pw.failures.map((f) => f.kind)).toEqual(['decrypt']);
    expect(store.rows('credential.password_enc')[0].value).toBe(moved);
  });

  it('읽은 뒤 사용자가 값을 바꾸면 덮어쓰지 않고 conflicts 로 센다', async () => {
    const store = legacyStore();
    const rotating = crypto({ keys: [NEW, OLD], legacySecret: LEGACY });
    const userEdit = rotating.encrypt('edited-by-user', PW(1));
    store.beforeReplace = (label, row) => {
      if (label === 'credential.password_enc' && row.id === 1)
        row.value = userEdit;
    };
    const [pw] = await new CryptoAuditService(store, rotating).reencrypt();
    expect(pw).toMatchObject({ converted: 2, conflicts: 1 });
    expect(store.rows('credential.password_enc')[0].value).toBe(userEdit);
  });

  it('점검 표에는 값이 나오지 않는다 — 건수·키 ID·행 위치만', async () => {
    const store = legacyStore();
    const text = formatReports(
      await new CryptoAuditService(store, crypto({})).verify(),
    );
    expect(text).toContain('credential.password_enc');
    expect(text).toContain('✗ credential.password_enc#2 [missing-key]');
    expect(text).not.toContain('sk-proj-plaintext');
    expect(text).not.toContain(store.rows('credential.password_enc')[0].value);
  });
});

describe('CryptoBootstrapService — 부팅 시 점검', () => {
  it('설정에 없는 키로 된 암호문이 있으면 부팅을 멈춘다', async () => {
    const c = crypto({});
    const boot = new CryptoBootstrapService(
      c,
      new CryptoAuditService(legacyStore(), c),
    );
    await expect(boot.onApplicationBootstrap()).rejects.toThrow(
      '설정에 없는 키로 된 암호문 3건',
    );
  });

  it('한 키로 된 암호문이 하나도 안 풀리면(시크릿 오타) 부팅을 멈춘다 — 첫 열람 때 500 이 아니라', async () => {
    const store = legacyStore();
    const typo = crypto({
      keys: [
        NEW,
        { id: OLD.id, secret: 'typo-crypto-key-0123456789abcdef-012' },
      ],
      legacySecret: LEGACY,
    });
    const boot = new CryptoBootstrapService(
      typo,
      new CryptoAuditService(store, typo),
    );
    await expect(boot.onApplicationBootstrap()).rejects.toThrow(
      '키 k2609 로 된 암호문이 하나도 복호화되지 않음',
    );
  });

  it('일부 행만 안 풀리면(데이터 손상·옮겨진 행) 로그만 남기고 부팅·재암호화를 계속한다', async () => {
    const store = legacyStore();
    store.rows('credential.password_enc').push({
      id: 4,
      userId: 1,
      value: v1Encrypt(
        'other-legacy',
        'another-legacy-secret-0123456789abcdef',
      ),
    });
    const c = crypto({ keys: [NEW, OLD], legacySecret: LEGACY });
    await new CryptoBootstrapService(
      c,
      new CryptoAuditService(store, c),
    ).onApplicationBootstrap();
    const values = store.rows('credential.password_enc').map((r) => r.value);
    expect(values.slice(0, 3).every((v) => v.startsWith('v2:k2612:'))).toBe(
      true,
    );
    expect(values[3]).toMatch(/^v1:/);
  });

  it('키가 다 있으면 현재 키가 아닌 암호문을 재암호화하고 부팅을 이어 간다', async () => {
    const store = legacyStore();
    const c = crypto({ keys: [NEW, OLD], legacySecret: LEGACY });
    await new CryptoBootstrapService(
      c,
      new CryptoAuditService(store, c),
    ).onApplicationBootstrap();
    expect(
      store
        .rows('credential.password_enc')
        .every((r) => r.value.startsWith('v2:k2612:')),
    ).toBe(true);
  });
});
