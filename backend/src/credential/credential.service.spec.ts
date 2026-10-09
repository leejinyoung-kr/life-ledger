import { BadRequestException, NotFoundException } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { CredentialService } from './credential.service';
import { CryptoService } from '@leejinyoung-kr/core-security';
import { cryptoOptions } from '../crypto/crypto-options';
import { cipherContext } from '../crypto/crypto-fields';

// 계정 보관함 — 비번/TOTP 암호화 저장·복호화·백업코드·엑셀 입출력 회귀 테스트.
// CryptoService 는 실제 사용(라운드트립 검증, test/setup-env.ts 의 CRYPTO_KEYS), Prisma/AccessLog 는 인메모리 가짜.
describe('CredentialService', () => {
  const crypto = new CryptoService(cryptoOptions());
  // 사용자 1 의 비밀번호 문맥
  const PW = cipherContext('credential.password_enc', 1);

  let store: any[];
  let seq: number;
  let prisma: any;
  let accessLog: any;
  const svc = () => new CredentialService(prisma, crypto, accessLog);

  beforeEach(() => {
    store = [];
    seq = 1;
    accessLog = { log: jest.fn() };
    prisma = {
      credential: {
        findMany: jest.fn(async ({ where }: any) =>
          store.filter((r) => r.user_id === where.user_id && r.deleted_at == null),
        ),
        findFirst: jest.fn(async ({ where }: any) =>
          store.find((r) => r.id === where.id && r.user_id === where.user_id && r.deleted_at == null) ?? null,
        ),
        create: jest.fn(async ({ data }: any) => {
          const row = { id: seq++, deleted_at: null, updated_at: new Date(), backup_codes_enc: null, totp_enc: null, ...data };
          store.push(row);
          return row;
        }),
        update: jest.fn(async ({ where, data }: any) => {
          const row = store.find((r) => r.id === where.id);
          Object.assign(row, data);
          row.updated_at = new Date();
          return row;
        }),
        createMany: jest.fn(async ({ data }: any) => {
          for (const d of data) store.push({ id: seq++, deleted_at: null, updated_at: new Date(), backup_codes_enc: null, ...d });
          return { count: data.length };
        }),
      },
    };
  });

  it('create: 비번 암호화 저장 + toDto 는 원문 숨김', async () => {
    const res = await svc().create(1, { name: 'GitHub', category: 'dev', username: 'me', password: 'p@ss' } as any);
    expect(res).not.toHaveProperty('password');
    expect(res.has2fa).toBe(false);
    expect(store[0].password_enc).toMatch(/^v2:test:/);
    expect(crypto.decrypt(store[0].password_enc, PW)).toBe('p@ss');
    expect(store[0].password_changed_at).toBeInstanceOf(Date);
  });

  it('reveal: 복호화된 비번/TOTP 반환 + 감사 로그 기록', async () => {
    await svc().create(1, { name: 'A', category: 'c', username: 'u', password: 'secret', totp: 'JBSWY3DPEHPK3PXP' } as any);
    const out = await svc().reveal(1, 1);
    expect(out.password).toBe('secret');
    expect(out.totp).toBe('JBSWY3DPEHPK3PXP');
    expect(accessLog.log).toHaveBeenCalledWith(1, 'cred_reveal', expect.objectContaining({ id: 1 }), undefined);
  });

  it('reveal: 타인/없는 항목은 NotFound', async () => {
    await svc().create(1, { name: 'A', category: 'c', username: 'u', password: 'x' } as any);
    await expect(svc().reveal(2, 1)).rejects.toThrow(NotFoundException);
  });

  it('totpCode: otpauth:// URI 에서 secret 추출해 6자리 생성', async () => {
    const uri = 'otpauth://totp/Acme:me?secret=JBSWY3DPEHPK3PXP&issuer=Acme';
    await svc().create(1, { name: 'A', category: 'c', username: 'u', password: 'x', totp: uri } as any);
    const out = await svc().totpCode(1, 1);
    expect(out.code).toMatch(/^\d{6}$/);
    expect(out.period).toBe(30);
  });

  it('totpCode: 2FA 없으면 BadRequest', async () => {
    await svc().create(1, { name: 'A', category: 'c', username: 'u', password: 'x' } as any);
    await expect(svc().totpCode(1, 1)).rejects.toThrow(BadRequestException);
  });

  it('백업코드: 생성 → 암호화 저장 → reveal 라운드트립', async () => {
    await svc().create(1, { name: 'A', category: 'c', username: 'u', password: 'x' } as any);
    const gen = await svc().generateBackupCodes(1, 1, 5);
    expect(gen.codes).toHaveLength(5);
    expect(gen.codes[0]).toMatch(/^[0-9A-F]{4}-[0-9A-F]{4}$/);
    const revealed = await svc().revealBackupCodes(1, 1);
    expect(revealed.codes).toEqual(gen.codes);
  });

  it('update: 새 비번 주면 재암호화 + 회전일 갱신', async () => {
    await svc().create(1, { name: 'A', category: 'c', username: 'u', password: 'old' } as any);
    const before = store[0].password_changed_at.getTime();
    await new Promise((r) => setTimeout(r, 5));
    await svc().update(1, 1, { password: 'new' } as any);
    expect(crypto.decrypt(store[0].password_enc, PW)).toBe('new');
    expect(store[0].password_changed_at.getTime()).toBeGreaterThanOrEqual(before);
  });

  it('importExcel: 필수값 누락 행은 error, 정상 행만 imported', async () => {
    const buf = await buildExcel([
      { 서비스명: 'A', 카테고리: 'c', 아이디: 'u', 비밀번호: 'p1' },
      { 서비스명: '', 카테고리: 'c', 아이디: 'u', 비밀번호: 'p2' },
    ]);
    const res = await svc().importExcel(1, buf);
    expect(res.imported).toBe(1);
    expect(res.failed).toBe(1);
    expect(crypto.decrypt(store[0].password_enc, PW)).toBe('p1');
  });

  it('export → import 라운드트립: 평문 비번 보존', async () => {
    await svc().create(1, { name: 'A', category: 'c', username: 'u', password: 'roundtrip!' } as any);
    const out = await svc().exportExcel(1);
    store.length = 0;
    const res = await svc().importExcel(1, out);
    expect(res.imported).toBe(1);
    expect(crypto.decrypt(store[0].password_enc, PW)).toBe('roundtrip!');
  });

  it('exportExcel: 전 계정 평문 내보내기는 열람 기록을 남긴다', async () => {
    await svc().exportExcel(1);
    expect(accessLog.log).toHaveBeenCalledWith(
      1,
      'data_export',
      expect.objectContaining({ name: 'export:credentials-xlsx' }),
      undefined,
    );
  });
});

// 헤더 + 행으로 .xlsx 버퍼 생성 (importExcel 입력용)
async function buildExcel(rows: Record<string, string>[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('계정');
  const headers = ['서비스명', 'URL', '카테고리', '아이디', '비밀번호', '2FA', '메모'];
  ws.addRow(headers);
  for (const r of rows) ws.addRow(headers.map((h) => r[h] ?? ''));
  return Buffer.from((await wb.xlsx.writeBuffer()) as ArrayBuffer);
}
