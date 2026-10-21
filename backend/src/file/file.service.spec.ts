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
import { StorageService } from '@leejinyoung-kr/core-storage';
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
        findMany: jest.fn().mockResolvedValue([]),
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
  });

  const notification = { createWithPush: jest.fn().mockResolvedValue({ title: 't', description: 'd' }) };
  const sysLog = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
  // @aws-sdk/client-s3, @aws-sdk/s3-request-presigner 가 모킹되어 있어
  // StorageService 내부의 S3 호출도 함께 가짜로 대체된다.
  const storage = new StorageService({
    bucket: 'test-bucket',
    endpoint: 'https://example.com',
    region: 'eu',
    accessKeyId: 'key',
    secretAccessKey: 'secret',
  });
  const svc = () => new FileService(prisma, notification as any, sysLog as any, storage);

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

  describe('업로드 — 파일명', () => {
    // multer 는 원본 파일명을 latin1 로 디코딩해서 준다 → utf8 로 재해석해야 한글이 살아난다
    const asMulter = (name: string) => Buffer.from(name, 'utf8').toString('latin1');

    it('맥에서 올린 조합형(NFD) 이름은 완성형(NFC)으로 저장한다 — 목록 검색이 못 찾는 것 방지', async () => {
      const nfd = '보고서.pdf'.normalize('NFD');
      const file = baseFile({ mimetype: 'text/plain', originalname: asMulter(nfd) });

      const out = await svc().upload(1, file);

      expect(out.name).toBe('보고서.pdf');
      expect(out.name.normalize('NFC')).toBe(out.name);
      expect(out.name).not.toBe(nfd);
    });

    it('윈도우·아이폰에서 올린 완성형 이름은 그대로 둔다', async () => {
      const file = baseFile({ mimetype: 'text/plain', originalname: asMulter('보고서 (최종).pdf') });

      expect((await svc().upload(1, file)).name).toBe('보고서 (최종).pdf');
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

  describe('getDownloadUrl — 파일명 헤더', () => {
    it('한글 파일명은 filename*(UTF-8) + ASCII 대체 이름 — 비표준 %XX filename 을 쓰지 않는다', async () => {
      prisma.storageFile.findFirst.mockResolvedValue({
        id: 1,
        object_key: 'users/1/x.pdf',
        name: '보고서.pdf',
        mime_type: 'application/pdf',
      });

      await svc().getDownloadUrl(1, 1);

      const cmd = (getSignedUrl as jest.Mock).mock.calls[0][1];
      expect(cmd.input.ResponseContentDisposition).toBe(
        `attachment; filename="___.pdf"; filename*=UTF-8''%EB%B3%B4%EA%B3%A0%EC%84%9C.pdf`,
      );
    });
  });

  describe('removeFolder — 재귀삭제 단일 트랜잭션', () => {
    it('하위 폴더 전체 id를 한 트랜잭션의 in 조건으로 일괄 soft delete', async () => {
      prisma.storageFolder.findFirst.mockResolvedValue({ id: 1, user_id: 1, deleted_at: null });
      // 1 -> [2,3], 2 -> [4], 5 는 다른 루트 폴더
      prisma.storageFolder.findMany.mockResolvedValue([
        { id: 1, name: 'a', parent_id: null },
        { id: 2, name: 'b', parent_id: 1 },
        { id: 3, name: 'c', parent_id: 1 },
        { id: 4, name: 'd', parent_id: 2 },
        { id: 5, name: 'e', parent_id: null },
      ]);

      await svc().removeFolder(1, 1);

      // 하위 폴더는 폴더마다 조회하지 않고 한 번에 읽는다
      expect(prisma.storageFolder.findMany).toHaveBeenCalledTimes(1);
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

    it('지운 파일의 B2 오브젝트는 다른 파일이 같이 쓰지 않을 때만 지운다', async () => {
      prisma.storageFolder.findFirst.mockResolvedValue({ id: 1, user_id: 1, deleted_at: null });
      prisma.storageFolder.findMany.mockResolvedValue([]);
      prisma.storageFile.findMany
        .mockResolvedValueOnce([{ object_key: 'k1' }, { object_key: 'k2' }, { object_key: 'k1' }]) // 폴더 안 파일
        .mockResolvedValueOnce([{ object_key: 'k2' }]); // 지운 뒤에도 k2 는 다른 폴더 파일이 쓴다
      sendMock.mockClear();

      const res = await svc().removeFolder(1, 1);

      const deletes = sendMock.mock.calls.map((c) => c[0]).filter((cmd: any) => cmd.__type === 'Delete');
      expect(deletes.map((d: any) => d.input.Key)).toEqual(['k1']);
      expect(res).toEqual({ id: 1, purgedObjects: 1 });
    });
  });

  describe('ensureFolderPath — 폴더째 업로드', () => {
    it('있는 폴더는 그대로 쓰고 없는 칸만 만든다', async () => {
      prisma.storageFolder.findFirst
        .mockResolvedValueOnce({ id: 7 }) // 보험 — 이미 있음
        .mockResolvedValueOnce(null); // 2026 — 없음
      prisma.storageFolder.create.mockResolvedValue({ id: 8 });

      const id = await svc().ensureFolderPath(1, null, '보험/ 2026 /');

      expect(id).toBe(8);
      expect(prisma.storageFolder.findFirst).toHaveBeenNthCalledWith(1, expect.objectContaining({ where: expect.objectContaining({ parent_id: null, name: '보험' }) }));
      expect(prisma.storageFolder.create).toHaveBeenCalledWith(expect.objectContaining({ data: { user_id: 1, parent_id: 7, name: '2026' } }));
    });

    it('너무 깊은 경로는 거부한다', async () => {
      await expect(svc().ensureFolderPath(1, null, Array(21).fill('a').join('/'))).rejects.toBeInstanceOf(BadRequestException);
    });
  });
  describe('search — 모든 폴더에서 찾기', () => {
    it('파일·폴더를 위치(루트 → 들어 있는 폴더)와 함께 돌려준다', async () => {
      prisma.storageFolder.findMany.mockResolvedValue([
        { id: 1, name: '보험', parent_id: null, created_at: new Date() },
        { id: 2, name: '보험 영수증', parent_id: 1, created_at: new Date() },
      ]);
      prisma.storageFile.findMany = jest.fn().mockResolvedValue([
        { id: 9, name: '보험증권.pdf', size: BigInt(10), mime_type: 'application/pdf', folder_id: 2, created_at: new Date() },
      ]);
      prisma.storageFile.groupBy = jest.fn().mockResolvedValue([{ folder_id: 2, _count: { _all: 1 } }]);

      const res = await svc().search(1, ' 보험 ');

      expect(prisma.storageFile.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ name: { contains: '보험' } }) }));
      expect(res.files[0].path.map((c: any) => c.name)).toEqual(['보험', '보험 영수증']);
      expect(res.folders.map((f: any) => [f.name, f.path.map((c: any) => c.name), f.fileCount, f.childFolderCount])).toEqual([
        ['보험', [], 0, 1],
        ['보험 영수증', ['보험'], 1, 0],
      ]);
      expect(res.truncated).toBe(false);
    });

    it('빈 검색어는 조회하지 않는다', async () => {
      expect(await svc().search(1, '   ')).toEqual({ folders: [], files: [], truncated: false });
      expect(prisma.storageFolder.findMany).not.toHaveBeenCalled();
    });
  });

  describe('planZip — ZIP 으로 받을 파일', () => {
    const file = (id: number, folder_id: number | null, size = 100) =>
      ({ id, name: `f${id}.pdf`, size: BigInt(size), mime_type: 'application/pdf', folder_id, object_key: `k${id}`, created_at: new Date() });

    beforeEach(() => {
      prisma.storageFolder.findMany.mockResolvedValue([
        { id: 1, name: '보험', parent_id: null },
        { id: 2, name: '2026', parent_id: 1 },
        { id: 3, name: '사진', parent_id: null },
      ]);
      prisma.storageFile.findMany = jest.fn().mockResolvedValue([file(10, 1), file(11, 2), file(12, 2)]);
    });

    it('폴더를 고르면 그 폴더와 하위 폴더만, 경로는 그 폴더 기준', async () => {
      prisma.storageFolder.findFirst.mockResolvedValue({ id: 1, name: '보험', parent_id: null });
      const plan = await svc().planZip(1, 1);
      expect(prisma.storageFile.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ folder_id: { in: [1, 2] } }) }));
      expect(plan.rootName).toBe('보험');
      expect(plan.entries.map((e) => e.path)).toEqual(['f10.pdf', '2026/f11.pdf', '2026/f12.pdf']);
      expect(plan.totalBytes).toBe(300);
    });

    it('폴더를 안 고르면 보관함 전체를 담는다', async () => {
      const plan = await svc().planZip(1, undefined);
      expect(plan.rootName).toBeNull();
      expect(plan.entries.map((e) => e.path)).toEqual(['보험/f10.pdf', '보험/2026/f11.pdf', '보험/2026/f12.pdf']);
    });

    it('assertZippable 은 비었거나 2GB 를 넘으면 거부한다', () => {
      const s = svc();
      expect(() => s.assertZippable({ entries: [], totalBytes: 0 })).toThrow('받을 파일이 없습니다');
      const one = [{ path: 'a', name: 'a', objectKey: 'k', mimeType: 'text/plain', createdAt: new Date() }];
      expect(() => s.assertZippable({ entries: one, totalBytes: 3 * 1024 ** 3 })).toThrow(BadRequestException);
      expect(() => s.assertZippable({ entries: one, totalBytes: 10 })).not.toThrow();
    });
  });
  describe('clear — 비우기', () => {
    const file = (id: number, folder_id: number | null, size = 100) => ({ id, folder_id, object_key: `k${id}`, size: BigInt(size) });

    beforeEach(() => {
      // 보험(1) > 2026(2), 사진(3)
      prisma.storageFolder.findMany.mockResolvedValue([
        { id: 1, name: '보험', parent_id: null },
        { id: 2, name: '2026', parent_id: 1 },
        { id: 3, name: '사진', parent_id: null },
      ]);
    });

    it('보관함 전체를 비우면 모든 파일과 폴더를 지운다', async () => {
      prisma.storageFile.findMany.mockResolvedValueOnce([file(10, 1), file(11, 3), file(12, 2), file(13, null)]);
      const plan = await svc().planClear(1, undefined);
      expect(plan.fileIds).toEqual([10, 11, 12, 13]);
      expect(plan.folderIds).toEqual([1, 2, 3]);
      expect(plan.totalBytes).toBe(400);
    });

    it('폴더를 비우면 그 폴더 자신은 남기고 하위만 지운다', async () => {
      prisma.storageFolder.findFirst.mockResolvedValue({ id: 1, name: '보험', parent_id: null });
      prisma.storageFile.findMany.mockResolvedValueOnce([file(10, 1), file(12, 2)]);
      const plan = await svc().planClear(1, 1);
      expect(prisma.storageFile.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ folder_id: { in: [1, 2] } }) }));
      expect(plan.fileIds).toEqual([10, 12]);
      expect(plan.folderIds).toEqual([2]);
    });

    it('한 트랜잭션으로 지우고 남는 데 없는 B2 오브젝트를 지운다', async () => {
      prisma.storageFile.findMany
        .mockResolvedValueOnce([file(10, 1), file(11, 3), file(12, 2)])
        .mockResolvedValueOnce([]); // 지운 뒤 k10·k11 을 쓰는 파일 없음
      sendMock.mockClear();

      const res = await svc().clear(1, undefined);

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.storageFile.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: { in: [10, 11, 12] } }) }));
      expect(prisma.storageFolder.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: { in: [1, 2, 3] } }) }));
      const deletes = sendMock.mock.calls.map((c) => c[0]).filter((cmd: any) => cmd.__type === 'Delete');
      expect(deletes.map((d: any) => d.input.Key)).toEqual(['k10', 'k11', 'k12']);
      expect(res).toEqual({ deletedFiles: 3, deletedFolders: 3, purgedObjects: 3 });
    });
  });
});
