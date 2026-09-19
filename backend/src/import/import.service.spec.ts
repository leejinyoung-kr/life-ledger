import { BadRequestException } from '@nestjs/common';
import { CryptoService } from '@leejinyoun/core-security';
import { ImportService } from './import.service';
import { cryptoOptions } from '../crypto/crypto-options';
import { cipherContext, exportContext } from '../crypto/crypto-fields';
import type { AuthUser } from '../auth/auth-user';
import { v1Encrypt } from '../../test/v1-cipher';

const LEGACY = 'legacy-credential-secret-0123456789abcdef';

// 계정 백업 JSON 복원 — 백업 암호문을 풀어 복원하는 사용자의 저장 문맥으로 다시 암호화하는지,
// 풀리지 않는 행(다른 계정·없는 키·손상)을 넣지 않고 오류로 돌려주는지 검증한다
describe('ImportService (계정 복원)', () => {
  const crypto = new CryptoService(cryptoOptions());
  const me: AuthUser = {
    id: 1,
    email: 'tester@example.com',
    name: 't',
    picture: '',
  };
  const PW = 'credential.password_enc' as const;
  const TOTP = 'credential.totp_enc' as const;
  // 계정 JSON 백업(export.credentialsJson)이 담는 암호문 — 이메일 문맥
  const backup = (
    plain: string,
    email = me.email,
    field: typeof PW | typeof TOTP = PW,
  ) => crypto.encrypt(plain, exportContext(field, email));

  let created: any[];
  let existingRows: any[];
  const prisma: any = {
    credential: {
      // 멱등성 dedup 용 — 기존 계정 (name|username) 조회
      findMany: jest.fn(async () => existingRows),
      createMany: jest.fn(async ({ data }: any) => {
        created.push(...data);
        return { count: data.length };
      }),
    },
  };
  const svc = (c: CryptoService = crypto) => new ImportService(prisma, c);
  const buf = (obj: any) => Buffer.from(JSON.stringify(obj), 'utf8');
  // 저장된 암호문을 복원한 사용자의 문맥으로 푼다
  const stored = (
    enc: string,
    userId = me.id,
    field: typeof PW | typeof TOTP = PW,
  ) => crypto.decrypt(enc, cipherContext(field, userId));

  beforeEach(() => {
    created = [];
    existingRows = [];
    jest.clearAllMocks();
  });

  it('깨진 JSON 거부', async () => {
    await expect(
      svc().restoreCredentials(me, Buffer.from('{not json', 'utf8')),
    ).rejects.toThrow(BadRequestException);
  });

  it('빈 배열/credentials 누락 거부', async () => {
    await expect(
      svc().restoreCredentials(me, buf({ credentials: [] })),
    ).rejects.toThrow(BadRequestException);
    await expect(svc().restoreCredentials(me, buf({}))).rejects.toThrow(
      BadRequestException,
    );
  });

  it('계정 JSON 백업 복원 — 저장 문맥(사용자 id)으로 다시 암호화 + 기본 카테고리', async () => {
    const res = await svc().restoreCredentials(
      me,
      buf({
        credentials: [
          {
            name: 'GitHub',
            username: 'me',
            password_enc: backup('pw!'),
            totp_enc: backup('JBSW', me.email, TOTP),
          },
        ],
      }),
    );
    expect(res).toEqual({ imported: 1, skipped: 0, errors: [] });
    expect(created[0]).toMatchObject({
      user_id: 1,
      name: 'GitHub',
      category: '기타',
    });
    expect(stored(created[0].password_enc)).toBe('pw!');
    expect(stored(created[0].totp_enc, me.id, TOTP)).toBe('JBSW');
  });

  it('DB 를 다시 만들어 사용자 id 가 바뀌어도 같은 계정(이메일)이면 복원된다', async () => {
    const reborn: AuthUser = { ...me, id: 7, email: 'Tester@Example.com' };
    const res = await svc().restoreCredentials(
      reborn,
      buf([{ name: 'A', username: 'u', password_enc: backup('pw') }]),
    );
    expect(res.imported).toBe(1);
    expect(stored(created[0].password_enc, 7)).toBe('pw');
  });

  it('다른 계정의 백업은 복원되지 않는다 — 넣지 않고 오류로 돌려준다', async () => {
    const res = await svc().restoreCredentials(
      me,
      buf([
        {
          name: 'Other',
          username: 'u',
          password_enc: backup('pw', 'someone@else.com'),
        },
      ]),
    );
    expect(res).toMatchObject({ imported: 0, skipped: 1 });
    expect(res.errors[0]).toContain('복호화 실패');
    expect(prisma.credential.createMany).not.toHaveBeenCalled();
  });

  it('ZIP 백업의 원본 행(저장 문맥)도 같은 사용자면 복원된다', async () => {
    const raw = crypto.encrypt('zip-pw', cipherContext(PW, me.id));
    const res = await svc().restoreCredentials(
      me,
      buf([{ name: 'Z', username: 'u', password_enc: raw }]),
    );
    expect(res.imported).toBe(1);
    expect(stored(created[0].password_enc)).toBe('zip-pw');
  });

  it('v1(이전 포맷) 백업은 CREDENTIAL_SECRET 이 있을 때만 복원되고, 현재 키로 다시 암호화된다', async () => {
    const withLegacy = new CryptoService({
      ...cryptoOptions(),
      legacySecret: LEGACY,
    });
    const file = buf([
      { name: 'Old', username: 'u', password_enc: v1Encrypt('old-pw', LEGACY) },
    ]);

    const ok = await svc(withLegacy).restoreCredentials(me, file);
    expect(ok.imported).toBe(1);
    expect(created[0].password_enc).toMatch(/^v2:test:/);
    expect(stored(created[0].password_enc)).toBe('old-pw');

    created = [];
    const no = await svc().restoreCredentials(me, file);
    expect(no).toMatchObject({ imported: 0, skipped: 1 });
    expect(no.errors[0]).toContain('복호화 실패');
  });

  it('name/username/password_enc 누락 시 skip (createMany 미호출)', async () => {
    const res = await svc().restoreCredentials(
      me,
      buf([
        { username: 'me', password_enc: backup('x') }, // name 없음
        { name: 'X', password_enc: backup('x') }, // username 없음
        { name: 'Y', username: 'u' }, // enc 없음
      ]),
    );
    expect(res.imported).toBe(0);
    expect(res.skipped).toBe(3);
    expect(prisma.credential.createMany).not.toHaveBeenCalled();
  });

  it('평문/손상 암호문은 error 기록 + skip', async () => {
    const res = await svc().restoreCredentials(
      me,
      buf([{ name: 'Plain', username: 'u', password_enc: 'plaintext-pw' }]),
    );
    expect(res.imported).toBe(0);
    expect(res.skipped).toBe(1);
    expect(res.errors).toHaveLength(1);
    expect(res.errors[0]).toContain('Plain');
  });

  it('2FA 암호문이 깨졌으면 행 전체를 오류로 — 조용히 2FA 없이 복원하지 않는다', async () => {
    const res = await svc().restoreCredentials(
      me,
      buf([
        {
          name: 'A',
          username: 'u',
          password_enc: backup('pw'),
          totp_enc: 'garbage',
        },
        {
          name: 'B',
          username: 'u',
          password_enc: backup('pw'),
          totp_enc: backup('T', 'someone@else.com', TOTP),
        },
        {
          name: 'C',
          username: 'u',
          password_enc: backup('pw'),
          totp_enc: null,
        },
      ]),
    );
    expect(res).toMatchObject({ imported: 1, skipped: 2 });
    expect(res.errors).toHaveLength(2);
    expect(created[0]).toMatchObject({ name: 'C', totp_enc: null });
  });

  it('래퍼 없는 배열 자체도 허용', async () => {
    const res = await svc().restoreCredentials(
      me,
      buf([{ name: 'A', username: 'u', password_enc: backup('x') }]),
    );
    expect(res.imported).toBe(1);
  });

  it('기존 계정과 (name|username) 중복이면 skip (멱등성)', async () => {
    existingRows = [{ name: 'GitHub', username: 'me' }];
    const res = await svc().restoreCredentials(
      me,
      buf([
        { name: 'GitHub', username: 'me', password_enc: backup('x') }, // 이미 존재 → skip
        { name: 'GitHub', username: 'other', password_enc: backup('x') }, // 신규 → 삽입
      ]),
    );
    expect(res.imported).toBe(1);
    expect(res.skipped).toBe(1);
    expect(created).toHaveLength(1);
    expect(created[0].username).toBe('other');
  });

  it('같은 파일 내 중복도 한 번만 삽입', async () => {
    const res = await svc().restoreCredentials(
      me,
      buf([
        { name: 'Dup', username: 'u', password_enc: backup('x') },
        { name: 'Dup', username: 'u', password_enc: backup('x') },
      ]),
    );
    expect(res.imported).toBe(1);
    expect(res.skipped).toBe(1);
  });
});
