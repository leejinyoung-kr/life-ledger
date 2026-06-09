import { BadRequestException } from '@nestjs/common';
import { ImportService } from './import.service';

// 계정 백업 JSON 복원 — 암호문 형식 검증/필수필드 스킵 로직 회귀 테스트.
// 복원은 평문화 없이 암호문(v1:...) 보존이 핵심이므로 손상/평문 차단을 집중 검증.
describe('ImportService (계정 복원)', () => {
  let created: any[];

  const prisma: any = {
    credential: {
      createMany: jest.fn(async ({ data }: any) => {
        created.push(...data);
        return { count: data.length };
      }),
    },
  };
  const svc = () => new ImportService(prisma);
  const buf = (obj: any) => Buffer.from(JSON.stringify(obj), 'utf8');
  const CIPHER = 'v1:abc123:def456:0a1b2c';

  beforeEach(() => {
    created = [];
    jest.clearAllMocks();
  });

  it('깨진 JSON 거부', async () => {
    await expect(
      svc().restoreCredentials(1, Buffer.from('{not json', 'utf8')),
    ).rejects.toThrow(BadRequestException);
  });

  it('빈 배열/credentials 누락 거부', async () => {
    await expect(svc().restoreCredentials(1, buf({ credentials: [] }))).rejects.toThrow(BadRequestException);
    await expect(svc().restoreCredentials(1, buf({}))).rejects.toThrow(BadRequestException);
  });

  it('유효 암호문 1건 복원 + 기본 카테고리 적용', async () => {
    const res = await svc().restoreCredentials(
      1,
      buf({ credentials: [{ name: 'GitHub', username: 'me', password_enc: CIPHER }] }),
    );
    expect(res.imported).toBe(1);
    expect(created[0]).toMatchObject({
      user_id: 1,
      name: 'GitHub',
      password_enc: CIPHER,
      category: '기타',
    });
  });

  it('name/username/password_enc 누락 시 skip (createMany 미호출)', async () => {
    const res = await svc().restoreCredentials(1, buf([
      { username: 'me', password_enc: CIPHER }, // name 없음
      { name: 'X', password_enc: CIPHER }, // username 없음
      { name: 'Y', username: 'u' }, // enc 없음
    ]));
    expect(res.imported).toBe(0);
    expect(res.skipped).toBe(3);
    expect(prisma.credential.createMany).not.toHaveBeenCalled();
  });

  it('평문/손상 암호문은 error 기록 + skip', async () => {
    const res = await svc().restoreCredentials(1, buf([
      { name: 'Plain', username: 'u', password_enc: 'plaintext-pw' },
    ]));
    expect(res.imported).toBe(0);
    expect(res.skipped).toBe(1);
    expect(res.errors).toHaveLength(1);
    expect(res.errors[0]).toContain('Plain');
  });

  it('totp_enc 는 v1: 형식만 보존, 아니면 null', async () => {
    await svc().restoreCredentials(1, buf([
      { name: 'A', username: 'u', password_enc: CIPHER, totp_enc: 'v1:x:y:z' },
      { name: 'B', username: 'u', password_enc: CIPHER, totp_enc: 'garbage' },
    ]));
    expect(created[0].totp_enc).toBe('v1:x:y:z');
    expect(created[1].totp_enc).toBeNull();
  });

  it('래퍼 없는 배열 자체도 허용', async () => {
    const res = await svc().restoreCredentials(1, buf([
      { name: 'A', username: 'u', password_enc: CIPHER },
    ]));
    expect(res.imported).toBe(1);
  });
});
