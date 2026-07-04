import { BadRequestException } from '@nestjs/common';

const sendMock = jest.fn().mockResolvedValue({});
jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({ send: sendMock })),
  PutObjectCommand: jest.fn().mockImplementation((input) => ({ input, __type: 'Put' })),
  DeleteObjectCommand: jest.fn().mockImplementation((input) => ({ input, __type: 'Delete' })),
  GetObjectCommand: jest.fn().mockImplementation((input) => ({ input, __type: 'Get' })),
}));
jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn().mockResolvedValue('https://signed.example/url'),
}));

import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { FileService } from './file.service';

// MIME 매직바이트 검증·inline XSS 차단·폴더 재귀삭제 단일 트랜잭션·업로드 보상삭제 회귀 테스트.
// S3 클라이언트는 send() 를 가짜로 대체하고, Prisma 도 인메모리 가짜로 대체.
describe('FileService', () => {
  let prisma: any;

  const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0]);
  const EXE = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]);
  const PLAIN_TEXT = Buffer.from('hello world');

  const baseFile = (overrides: Partial<Express.Multer.File> = {}): Express.Multer.File =>
    ({
      fieldname: 'file',
      originalname: 'a.bin',
      encoding: '7bit',
      size: 11,
      buffer: PLAIN_TEXT,
      mimetype: 'application/octet-stream',
      ...overrides,
    }) as Express.Multer.File;

  beforeEach(() => {
    sendMock.mockClear();
    (getSignedUrl as jest.Mock).mockClear();
    prisma = {
      storageFile: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn(async ({ data }: any) => ({ id: 1, created_at: new Date(), ...data })),
        update: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
        updateMany: jest.fn(),
      },
      storageFolder: {
        findFirst: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      userSettings: { findUnique: jest.fn().mockResolvedValue({ notif_upload: false }) },
      $transaction: jest.fn((ops: any[]) => Promise.all(ops)),
    };
    process.env.B2_BUCKET_NAME = 'test-bucket';
    process.env.B2_ENDPOINT = 'https://example.com';
    process.env.B2_BUCKET_REGION = 'eu';
    process.env.B2_KEY_ID = 'key';
    process.env.B2_APPLICATION_KEY = 'secret';
  });

  const notification = { create: jest.fn().mockResolvedValue({ title: 't', description: 'd' }) };
  const push = { sendToUser: jest.fn() };
  const sysLog = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
  const svc = () => new FileService(prisma, notification as any, push as any, sysLog as any);

  describe('업로드 — MIME 매직바이트 검증', () => {
    it('declared mime 과 실제 시그니처가 다르면 거부', async () => {
      const file = baseFile({ mimetype: 'image/jpeg', buffer: PNG, size: PNG.length });
      await expect(svc().upload(1, file)).rejects.toThrow(BadRequestException);
    });

    it('실행파일 시그니처는 declared mime 과 무관하게 거부', async () => {
      const file = baseFile({ mimetype: 'application/octet-stream', buffer: EXE, size: EXE.length });
      await expect(svc().upload(1, file)).rejects.toThrow(BadRequestException);
    });

    it('declared mime 과 시그니처가 일치하면 통과', async () => {
      const file = baseFile({ mimetype: 'image/png', buffer: PNG, size: PNG.length, originalname: 'a.png' });
      const out = await svc().upload(1, file);
      expect(out.mimeType).toBe('image/png');
    });

    it('알려진 시그니처가 없는 형식(text 등)은 통과', async () => {
      const file = baseFile({ mimetype: 'text/plain', originalname: 'a.txt' });
      const out = await svc().upload(1, file);
      expect(out.mimeType).toBe('text/plain');
    });
  });

  describe('업로드 — DB 실패 시 B2 보상삭제', () => {
    it('신규 업로드 후 DB create 실패 시 업로드한 오브젝트를 삭제', async () => {
      prisma.storageFile.create.mockRejectedValue(new Error('db down'));
      const file = baseFile({ mimetype: 'text/plain', originalname: 'a.txt' });

      await expect(svc().upload(1, file)).rejects.toThrow('db down');

      const calls = sendMock.mock.calls.map(([cmd]) => cmd.__type);
      expect(calls).toEqual(['Put', 'Delete']);
    });

    it('dedup(기존 오브젝트 재사용) 시 DB create 실패해도 B2 삭제하지 않음', async () => {
      prisma.storageFile.findFirst.mockResolvedValue({ object_key: 'users/1/existing.txt' });
      prisma.storageFile.create.mockRejectedValue(new Error('db down'));
      const file = baseFile({ mimetype: 'text/plain', originalname: 'a.txt' });

      await expect(svc().upload(1, file)).rejects.toThrow('db down');

      expect(sendMock).not.toHaveBeenCalled();
    });
  });

  describe('getDownloadUrl — inline XSS 차단', () => {
    it('text/html 은 inline 요청해도 attachment 로 강제', async () => {
      prisma.storageFile.findFirst.mockResolvedValue({
        id: 1,
        object_key: 'users/1/x.html',
        name: 'x.html',
        mime_type: 'text/html',
      });

      await svc().getDownloadUrl(1, 1, 'inline');

      const cmd = (getSignedUrl as jest.Mock).mock.calls[0][1];
      expect(cmd.input.ResponseContentDisposition).toMatch(/^attachment/);
    });

    it('image/svg+xml 도 inline 요청해도 attachment 로 강제', async () => {
      prisma.storageFile.findFirst.mockResolvedValue({
        id: 1,
        object_key: 'users/1/x.svg',
        name: 'x.svg',
        mime_type: 'image/svg+xml',
      });

      await svc().getDownloadUrl(1, 1, 'inline');

      const cmd = (getSignedUrl as jest.Mock).mock.calls[0][1];
      expect(cmd.input.ResponseContentDisposition).toMatch(/^attachment/);
    });

    it('image/png 은 inline 요청 시 inline 유지', async () => {
      prisma.storageFile.findFirst.mockResolvedValue({
        id: 1,
        object_key: 'users/1/x.png',
        name: 'x.png',
        mime_type: 'image/png',
      });

      await svc().getDownloadUrl(1, 1, 'inline');

      const cmd = (getSignedUrl as jest.Mock).mock.calls[0][1];
      expect(cmd.input.ResponseContentDisposition).toMatch(/^inline/);
    });
  });

  describe('removeFolder — 재귀삭제 단일 트랜잭션', () => {
    it('하위 폴더 전체 id를 한 트랜잭션의 in 조건으로 일괄 soft delete', async () => {
      prisma.storageFolder.findFirst.mockResolvedValue({ id: 1, user_id: 1, deleted_at: null });
      // 1 -> [2,3], 2 -> [4], 3 -> [], 4 -> []
      prisma.storageFolder.findMany
        .mockResolvedValueOnce([{ id: 2 }, { id: 3 }])
        .mockResolvedValueOnce([{ id: 4 }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      await svc().removeFolder(1, 1);

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      const [fileOp, folderOp] = prisma.$transaction.mock.calls[0][0];
      expect(prisma.storageFile.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ folder_id: { in: [1, 2, 3, 4] } }) }),
      );
      expect(prisma.storageFolder.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ id: { in: [1, 2, 3, 4] } }) }),
      );
      expect([fileOp, folderOp]).toHaveLength(2);
    });
  });
});
