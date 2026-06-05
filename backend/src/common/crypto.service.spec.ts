import { CryptoService } from './crypto.service';

describe('CryptoService (AES-256-GCM)', () => {
  const ORIGINAL = process.env.CREDENTIAL_SECRET;

  beforeAll(() => {
    process.env.CREDENTIAL_SECRET = 'unit-test-secret-key';
  });
  afterAll(() => {
    process.env.CREDENTIAL_SECRET = ORIGINAL;
  });

  const crypto = () => new CryptoService();

  it('암호화→복호화 라운드트립이 원문과 일치한다', () => {
    const c = crypto();
    const plain = 'p@ssw0rd! 한글 値 🔐';
    expect(c.decrypt(c.encrypt(plain))).toBe(plain);
  });

  it('저장 포맷은 v1:iv:tag:cipher (4토막)', () => {
    const out = crypto().encrypt('hello');
    const parts = out.split(':');
    expect(parts).toHaveLength(4);
    expect(parts[0]).toBe('v1');
  });

  it('같은 평문도 매번 다른 암호문 (랜덤 IV)', () => {
    const c = crypto();
    expect(c.encrypt('same')).not.toBe(c.encrypt('same'));
  });

  it('변조된 암호문은 복호화 시 예외 (GCM 인증 태그)', () => {
    const c = crypto();
    const enc = c.encrypt('secret');
    const parts = enc.split(':');
    // cipher 마지막 글자 변경
    parts[3] = parts[3].slice(0, -1) + (parts[3].endsWith('0') ? '1' : '0');
    expect(() => c.decrypt(parts.join(':'))).toThrow();
  });

  it('잘못된 포맷은 예외', () => {
    expect(() => crypto().decrypt('not-a-cipher')).toThrow();
    expect(() => crypto().decrypt('v2:a:b:c')).toThrow();
  });

  it('encryptNullable: 빈 값/undefined 는 null, 값이 있으면 복호화 가능', () => {
    const c = crypto();
    expect(c.encryptNullable('')).toBeNull();
    expect(c.encryptNullable(null)).toBeNull();
    expect(c.encryptNullable(undefined)).toBeNull();
    const enc = c.encryptNullable('x');
    expect(enc).not.toBeNull();
    expect(c.decrypt(enc!)).toBe('x');
  });

  it('CREDENTIAL_SECRET 미설정 시 사용 시점에 예외', () => {
    const saved = process.env.CREDENTIAL_SECRET;
    delete process.env.CREDENTIAL_SECRET;
    try {
      expect(() => new CryptoService().encrypt('x')).toThrow(/CREDENTIAL_SECRET/);
    } finally {
      process.env.CREDENTIAL_SECRET = saved;
    }
  });
});
