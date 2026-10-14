import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { StorageService } from '@leejinyoung-kr/core-storage';
import { createHash, randomUUID } from 'crypto';
import { Readable, type Writable } from 'stream';
import type { ReadableStream as WebReadableStream } from 'stream/web';
import { env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';
import { CreateFolderDto, MoveFileDto } from './dto/file.dto';
import { SystemLogService } from '../system-log/system-log.service';
import { folderPath, subtreeIds, zipPaths, type FolderNode } from './file-path.util';

// 전체 검색 결과 상한 (폴더·파일 각각)
const SEARCH_LIMIT = 200;
// 폴더째 업로드에서 받는 상대 경로 깊이 상한
const MAX_FOLDER_DEPTH = 20;
// ZIP 한 번에 받을 수 있는 원본 합계 — 브라우저가 받은 ZIP 을 메모리(blob)에 담아 저장하므로 크게 두지 않는다
export const ZIP_MAX_BYTES = 2 * 1024 ** 3;

// ZIP 에 담을 파일 한 개
export interface ZipEntry {
  path: string;
  name: string;
  objectKey: string;
  mimeType: string;
  createdAt: Date;
}

// 이미 압축된 형식은 다시 압축하지 않고 그대로 담는다 (홈서버 CPU 절약)
function isPrecompressed(mime: string): boolean {
  return /^(image|video|audio)\//.test(mime) || /zip|compressed|pdf/.test(mime);
}

@Injectable()
export class FileService {
  constructor(
    private prisma: PrismaService,
    private notification: NotificationService,
    private sysLog: SystemLogService,
    private storage: StorageService,
  ) {}

  // 현재 폴더의 하위 폴더·파일 목록 + 조상 경로(브레드크럼) + 전체 사용량
  async list(userId: number, folderId?: number) {
    const [folders, files, usage, ancestors] = await Promise.all([
      this.prisma.storageFolder.findMany({
        where: { user_id: userId, parent_id: folderId ?? null, deleted_at: null },
        orderBy: { created_at: 'asc' },
        include: { _count: { select: { files: { where: { deleted_at: null } }, children: { where: { deleted_at: null } } } } },
      }),
      this.prisma.storageFile.findMany({
        where: { user_id: userId, folder_id: folderId ?? null, deleted_at: null },
        orderBy: { created_at: 'desc' },
      }),
      this.prisma.storageFile.aggregate({
        where: { user_id: userId, deleted_at: null },
        _sum: { size: true },
      }),
      folderId ? this.buildBreadcrumb(userId, folderId) : Promise.resolve([]),
    ]);

    return {
      breadcrumb: ancestors,
      folders: folders.map((f) => ({
        id: f.id,
        name: f.name,
        parentId: f.parent_id,
        fileCount: f._count.files,
        childFolderCount: f._count.children,
        createdAt: f.created_at.toISOString(),
      })),
      files: files.map((f) => ({
        id: f.id,
        name: f.name,
        size: Number(f.size),
        mimeType: f.mime_type,
        folderId: f.folder_id,
        createdAt: f.created_at.toISOString(),
      })),
      totalBytes: Number(usage._sum.size ?? 0),
    };
  }

  // 이름으로 모든 폴더를 검색 — 폴더·파일 각각 최대 SEARCH_LIMIT 건, 위치(루트 → 들어 있는 폴더)를 함께 준다
  async search(userId: number, rawQ: string) {
    const q = rawQ.trim().normalize('NFC');
    if (!q) return { folders: [], files: [], truncated: false };

    const [allFolders, files] = await Promise.all([
      this.prisma.storageFolder.findMany({
        where: { user_id: userId, deleted_at: null },
        select: { id: true, name: true, parent_id: true, created_at: true },
      }),
      this.prisma.storageFile.findMany({
        where: { user_id: userId, deleted_at: null, name: { contains: q } },
        orderBy: { created_at: 'desc' },
        take: SEARCH_LIMIT + 1,
      }),
    ]);
    const byId = new Map<number, FolderNode>(allFolders.map((f) => [f.id, f]));
    const lower = q.toLowerCase();
    const matched = allFolders.filter((f) => f.name.normalize('NFC').toLowerCase().includes(lower));
    const folders = matched.slice(0, SEARCH_LIMIT);

    const fileCounts = folders.length
      ? await this.prisma.storageFile.groupBy({
        by: ['folder_id'],
        where: { user_id: userId, deleted_at: null, folder_id: { in: folders.map((f) => f.id) } },
        _count: { _all: true },
      })
      : [];
    const fileCountOf = new Map(fileCounts.map((c) => [c.folder_id, c._count._all]));
    const childCountOf = new Map<number, number>();
    for (const f of allFolders) if (f.parent_id !== null) childCountOf.set(f.parent_id, (childCountOf.get(f.parent_id) ?? 0) + 1);

    return {
      folders: folders.map((f) => ({
        id: f.id,
        name: f.name,
        parentId: f.parent_id,
        fileCount: fileCountOf.get(f.id) ?? 0,
        childFolderCount: childCountOf.get(f.id) ?? 0,
        createdAt: f.created_at.toISOString(),
        path: folderPath(byId, f.parent_id),
      })),
      files: files.slice(0, SEARCH_LIMIT).map((f) => ({
        id: f.id,
        name: f.name,
        size: Number(f.size),
        mimeType: f.mime_type,
        folderId: f.folder_id,
        createdAt: f.created_at.toISOString(),
        path: folderPath(byId, f.folder_id),
      })),
      truncated: matched.length > SEARCH_LIMIT || files.length > SEARCH_LIMIT,
    };
  }

  // ZIP 으로 받을 파일 목록 — 폴더(없으면 보관함 전체)와 그 하위 전부
  async planZip(userId: number, folderId: number | undefined) {
    const root = folderId ? await this.findOwnedFolder(userId, folderId) : null;
    const folders = await this.prisma.storageFolder.findMany({
      where: { user_id: userId, deleted_at: null },
      select: { id: true, name: true, parent_id: true },
    });
    const scope = folderId ? [...subtreeIds(folders, folderId)] : null;
    const files = await this.prisma.storageFile.findMany({
      where: { user_id: userId, deleted_at: null, ...(scope ? { folder_id: { in: scope } } : {}) },
      orderBy: { created_at: 'asc' },
    });
    const paths = zipPaths(new Map(folders.map((f) => [f.id, f])), folderId ?? null, files);

    return {
      rootName: root?.name ?? null,
      entries: files.map<ZipEntry>((f) => ({
        path: paths.get(f.id)!,
        name: f.name,
        objectKey: f.object_key,
        mimeType: f.mime_type,
        createdAt: f.created_at,
      })),
      totalBytes: files.reduce((sum, f) => sum + Number(f.size), 0),
    };
  }

  // ZIP 을 바로 흘려보낸다 — B2 오브젝트를 하나씩 받아 압축해 넘기므로 서버 메모리에 쌓이지 않는다.
  // 받는 쪽이 끊으면 남은 파일은 받지 않고 멈춘다
  async streamZip(userId: number, entries: ZipEntry[], out: Writable): Promise<void> {
    // archiver 8 은 ESM 전용이라 쓸 때만 불러온다 (jest 가 모듈을 읽다 깨지지 않게)
    const { ZipArchive } = await import('archiver');
    const archive = new ZipArchive({ zlib: { level: 6 } });
    let closed = false;
    out.on('close', () => {
      closed = true;
      archive.abort();
    });
    const failed = new Promise<never>((_, reject) => archive.on('error', reject));
    failed.catch(() => undefined);
    archive.pipe(out);

    try {
      for (const e of entries) {
        if (closed) return;
        const url = await this.storage.getDownloadUrl(e.objectKey, e.name, e.mimeType, 'attachment');
        const res = await fetch(url);
        if (!res.ok || !res.body) throw new Error(`스토리지 응답 ${res.status} (${e.path})`);
        const added = new Promise((resolve) => archive.once('entry', resolve));
        archive.append(Readable.fromWeb(res.body as WebReadableStream<Uint8Array>), {
          name: e.path,
          date: e.createdAt,
          store: isPrecompressed(e.mimeType),
        });
        await Promise.race([added, failed]);
      }
      if (!closed) await Promise.race([archive.finalize(), failed]);
    } catch (err) {
      if (closed) return;
      this.sysLog.error({
        userId,
        category: 'file',
        message: 'ZIP 다운로드 실패',
        metadata: { error: (err as Error).message, files: entries.length },
      });
      throw err;
    }
  }

  // ZIP 계획이 받을 수 있는 크기인지 — 비었거나 상한을 넘으면 400
  assertZippable(plan: { entries: ZipEntry[]; totalBytes: number }) {
    if (plan.entries.length === 0) {
      throw new BadRequestException('받을 파일이 없습니다.');
    }
    if (plan.totalBytes > ZIP_MAX_BYTES) {
      throw new BadRequestException('한 번에 받을 수 있는 용량(2GB)을 넘습니다. 하위 폴더별로 나눠 받으세요.');
    }
  }

  // 루트까지 올라가며 브레드크럼 배열 생성
  private async buildBreadcrumb(userId: number, folderId: number) {
    const crumbs: { id: number; name: string }[] = [];
    let currentId: number | null = folderId;

    while (currentId !== null) {
      const folder = await this.prisma.storageFolder.findFirst({
        where: { id: currentId, user_id: userId, deleted_at: null },
      });
      if (!folder) break;
      crumbs.unshift({ id: folder.id, name: folder.name });
      currentId = folder.parent_id;
    }

    return crumbs;
  }

  // 저장 한도(STORAGE_QUOTA_MB) 검사 — 지금 쓰는 용량 + 올릴 크기가 한도를 넘으면 거부. 한도가 없으면 통과
  private async assertQuota(userId: number, incoming: number): Promise<void> {
    if (!env.STORAGE_QUOTA_MB) return;
    const limit = env.STORAGE_QUOTA_MB * 1024 * 1024;
    const used = await this.prisma.storageFile.aggregate({ where: { user_id: userId, deleted_at: null }, _sum: { size: true } });
    if (Number(used._sum.size ?? 0) + incoming > limit) {
      throw new BadRequestException(`저장 한도(${env.STORAGE_QUOTA_MB}MB)를 넘습니다. 파일을 지우고 다시 올리세요.`);
    }
  }

  // 파일 업로드 — MIME 화이트리스트 검증 + SHA-256 중복 제거 후 B2 저장·DB 기록.
  // 동일 내용(해시 일치) 파일이 이미 있으면 B2 재업로드 없이 기존 오브젝트를 가리키는 메타만 추가한다.
  // relDir 가 있으면(폴더째 업로드) folderId 아래에 그 경로의 폴더를 찾거나 만들어 그 안에 넣는다
  async upload(userId: number, file: Express.Multer.File, folderId?: number, relDir?: string) {
    this.storage.validateUpload(file);
    await this.assertQuota(userId, file.size);

    if (folderId) await this.findOwnedFolder(userId, folderId);
    if (relDir) folderId = await this.ensureFolderPath(userId, folderId ?? null, relDir);

    // multer가 원본 파일명을 latin1로 디코딩하므로 한글 등 비ASCII 파일명은 utf8로 재해석.
    // NFC 정규화는 맥에서 올린 이름(NFD, 자모 분리) 대비 — 저장 형태가 갈리면 목록 검색(name.includes)이 못 찾는다
    const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8').normalize('NFC');
    const hash = createHash('sha256').update(file.buffer).digest('hex');

    // 동일 내용 파일이 이미 있으면 그 오브젝트 키를 재사용 (B2 업로드/저장 비용 절감)
    const dup = await this.prisma.storageFile.findFirst({
      where: { user_id: userId, hash, deleted_at: null },
    });
    const ext = originalName.split('.').pop() ?? '';
    const objectKey = dup?.object_key ?? `users/${userId}/${randomUUID()}${ext ? '.' + ext : ''}`;

    if (!dup) {
      await this.storage.putObject(objectKey, file.buffer, file.mimetype);
    }

    let saved;
    try {
      saved = await this.prisma.storageFile.create({
        data: {
          user_id: userId,
          folder_id: folderId ?? null,
          object_key: objectKey,
          name: originalName,
          size: file.size,
          mime_type: file.mimetype,
          hash,
        },
      });
    } catch (e) {
      // DB 기록 실패 시 방금 올린 B2 오브젝트 보상삭제 (dup 재사용분은 보존)
      if (!dup) {
        await this.storage.deleteObject(objectKey).catch((e2: unknown) => {
          this.sysLog.error({ userId, category: 'file', message: `DB 저장 실패 후 B2 보상삭제도 실패 — key: ${objectKey}`, metadata: { objectKey, dbError: (e as Error).message, b2Error: (e2 as Error).message } });
        });
      }
      throw e;
    }

    await this.notifyUploadComplete(userId, saved.name);

    return {
      id: saved.id,
      name: saved.name,
      size: Number(saved.size),
      mimeType: saved.mime_type,
      folderId: saved.folder_id,
      deduped: !!dup,
      createdAt: saved.created_at.toISOString(),
    };
  }

  // 설정(notif_upload)이 켜진 사용자에게만 업로드 완료 알림 생성 + 푸시. 알림 실패가 업로드 자체를 막지 않도록 격리
  private async notifyUploadComplete(userId: number, fileName: string): Promise<void> {
    try {
      const settings = await this.prisma.userSettings.findUnique({
        where: { user_id: userId },
        select: { notif_upload: true },
      });
      if (!settings?.notif_upload) return;
      await this.notification.createWithPush(
        userId,
        {
          group: 'system', tone: 'info',
          title: `${fileName} 업로드 완료`, description: '파일 보관함에 업로드가 완료됐습니다.', source: '파일 보관함',
        },
        { url: '/files' },
      );
    } catch {
      // 알림/푸시 실패는 업로드 성공 자체에 영향 없음
    }
  }

  // presigned 다운로드/미리보기 URL 발급 (5분 유효)
  // disposition: 'attachment'면 다운로드, 'inline'이면 브라우저 내 미리보기
  // text/html·image/svg+xml 등 inline 렌더링 시 XSS 위험이 있는 형식은 attachment 로 강제 전환
  // 파일명은 core-storage 가 filename*(UTF-8, NFC) + ASCII 대체 이름으로 싣는다 — 프론트의 a.download 는 B2 가 다른 origin 이라 무시된다
  async getDownloadUrl(userId: number, fileId: number, disposition: 'attachment' | 'inline' = 'attachment') {
    const file = await this.findOwnedFile(userId, fileId);
    const url = await this.storage.getDownloadUrl(file.object_key, file.name, file.mime_type, disposition);
    return { url };
  }

  // 파일 삭제 — DB soft delete. 동일 오브젝트를 가리키는 다른 파일(중복제거 공유)이 없을 때만 B2 오브젝트 삭제
  async removeFile(userId: number, fileId: number) {
    const file = await this.findOwnedFile(userId, fileId);

    await this.prisma.storageFile.update({
      where: { id: fileId },
      data: { deleted_at: new Date() },
    });

    // 같은 object_key 를 참조하는 미삭제 파일이 남아있으면 B2 오브젝트는 보존
    const stillReferenced = await this.prisma.storageFile.count({
      where: { object_key: file.object_key, deleted_at: null },
    });
    if (stillReferenced === 0) {
      await this.storage.deleteObject(file.object_key);
    }

    return { id: fileId };
  }

  // 파일 폴더 이동
  async moveFile(userId: number, fileId: number, dto: MoveFileDto) {
    await this.findOwnedFile(userId, fileId);
    if (dto.folderId) await this.findOwnedFolder(userId, dto.folderId);

    await this.prisma.storageFile.update({
      where: { id: fileId },
      data: { folder_id: dto.folderId },
    });

    return { id: fileId };
  }

  // "보험/2026" 같은 상대 경로를 parentId 아래에 한 칸씩 찾거나 만들고 마지막 폴더 id 를 돌려준다 (폴더째 업로드용).
  // 같은 이름 폴더가 이미 있으면 그 폴더를 쓴다 — 업로드는 프론트가 한 파일씩 차례로 보내므로 동시에 같은 폴더를 만들 일은 없다
  async ensureFolderPath(userId: number, parentId: number | null, relDir: string): Promise<number | undefined> {
    const segments = relDir.split('/').map((s) => s.normalize('NFC').trim()).filter(Boolean);
    if (segments.length > MAX_FOLDER_DEPTH) throw new BadRequestException(`폴더는 ${MAX_FOLDER_DEPTH}단계까지만 올릴 수 있습니다.`);
    let current = parentId;
    for (const name of segments) {
      if (name.length > 200) throw new BadRequestException('폴더 이름이 너무 깁니다 (200자).');
      const found = await this.prisma.storageFolder.findFirst({
        where: { user_id: userId, parent_id: current, name, deleted_at: null },
        orderBy: { id: 'asc' },
        select: { id: true },
      });
      current = found
        ? found.id
        : (await this.prisma.storageFolder.create({ data: { user_id: userId, parent_id: current, name }, select: { id: true } })).id;
    }
    return current ?? undefined;
  }

  // 폴더 생성 (parentId 없으면 루트에 생성)
  async createFolder(userId: number, dto: CreateFolderDto) {
    if (dto.parentId) await this.findOwnedFolder(userId, dto.parentId);

    const folder = await this.prisma.storageFolder.create({
      data: {
        user_id: userId,
        parent_id: dto.parentId ?? null,
        name: dto.name.trim(),
      },
    });

    return {
      id: folder.id,
      name: folder.name,
      parentId: folder.parent_id,
      fileCount: 0,
      childFolderCount: 0,
      createdAt: folder.created_at.toISOString(),
    };
  }

  // 폴더 삭제 — 하위 폴더/파일 재귀 soft delete 후, 더 이상 아무 파일도 가리키지 않는 B2 오브젝트를 지운다.
  // (예전에는 B2 오브젝트를 남겨 폴더를 지우고 같은 파일을 다시 올리면 B2 에 두 벌이 쌓였다)
  async removeFolder(userId: number, folderId: number) {
    await this.findOwnedFolder(userId, folderId);
    const keys = await this.deleteFolderRecursive(userId, folderId);
    const purged = await this.deleteUnreferencedObjects(userId, keys);
    return { id: folderId, purgedObjects: purged };
  }

  // 비우기에서 지울 것 — 폴더(없으면 보관함 전체) 안의 하위 폴더·파일 전부
  async planClear(userId: number, folderId: number | undefined) {
    if (folderId) await this.findOwnedFolder(userId, folderId);
    const folders = await this.prisma.storageFolder.findMany({
      where: { user_id: userId, deleted_at: null },
      select: { id: true, name: true, parent_id: true },
    });
    const scope = folderId ? subtreeIds(folders, folderId) : null;
    const files = await this.prisma.storageFile.findMany({
      where: { user_id: userId, deleted_at: null, ...(scope ? { folder_id: { in: [...scope] } } : {}) },
      select: { id: true, folder_id: true, object_key: true, size: true },
    });
    // 비우는 폴더 자신은 남기고 그 아래만 지운다
    const removedFolderIds = folders
      .map((f) => f.id)
      .filter((id) => (scope ? scope.has(id) && id !== folderId : true));

    return {
      fileIds: files.map((f) => f.id),
      folderIds: removedFolderIds,
      objectKeys: files.map((f) => f.object_key),
      totalBytes: files.reduce((sum, f) => sum + Number(f.size), 0),
    };
  }

  // 비우기 — planClear 의 폴더·파일을 한 트랜잭션으로 soft delete 하고, 남는 데 없는 B2 오브젝트를 지운다
  async clear(userId: number, folderId: number | undefined) {
    const plan = await this.planClear(userId, folderId);
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.storageFile.updateMany({
        where: { user_id: userId, id: { in: plan.fileIds }, deleted_at: null },
        data: { deleted_at: now },
      }),
      this.prisma.storageFolder.updateMany({
        where: { user_id: userId, id: { in: plan.folderIds }, deleted_at: null },
        data: { deleted_at: now },
      }),
    ]);
    const purged = await this.deleteUnreferencedObjects(userId, plan.objectKeys);
    return { deletedFiles: plan.fileIds.length, deletedFolders: plan.folderIds.length, purgedObjects: purged };
  }

  // 남은(미삭제) 파일이 하나도 가리키지 않는 오브젝트만 B2 에서 지운다 — 하나가 실패해도 나머지는 계속, 실패는 시스템 로그로
  private async deleteUnreferencedObjects(userId: number, keys: string[]): Promise<number> {
    const unique = [...new Set(keys)];
    if (unique.length === 0) return 0;
    const live = await this.prisma.storageFile.findMany({
      where: { object_key: { in: unique }, deleted_at: null },
      select: { object_key: true },
    });
    const stillUsed = new Set(live.map((f) => f.object_key));
    let purged = 0;
    for (const key of unique) {
      if (stillUsed.has(key)) continue;
      try {
        await this.storage.deleteObject(key);
        purged++;
      } catch (e) {
        this.sysLog.error({ userId, category: 'file', message: `삭제 후 B2 오브젝트 삭제 실패 — key: ${key}`, metadata: { objectKey: key, error: (e as Error).message } });
      }
    }
    return purged;
  }

  // BFS로 하위 폴더 id 전부 수집 후, 폴더·파일 soft delete를 단일 트랜잭션으로 일괄 처리. 지운 파일들의 오브젝트 키를 돌려준다
  private async deleteFolderRecursive(userId: number, folderId: number): Promise<string[]> {
    const ids = [folderId];
    const queue = [folderId];

    while (queue.length > 0) {
      const current = queue.shift()!;
      const children = await this.prisma.storageFolder.findMany({
        where: { user_id: userId, parent_id: current, deleted_at: null },
        select: { id: true },
      });
      for (const c of children) {
        ids.push(c.id);
        queue.push(c.id);
      }
    }

    const files = await this.prisma.storageFile.findMany({
      where: { user_id: userId, folder_id: { in: ids }, deleted_at: null },
      select: { object_key: true },
    });

    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.storageFile.updateMany({
        where: { user_id: userId, folder_id: { in: ids }, deleted_at: null },
        data: { deleted_at: now },
      }),
      this.prisma.storageFolder.updateMany({
        where: { id: { in: ids }, deleted_at: null },
        data: { deleted_at: now },
      }),
    ]);
    return files.map((f) => f.object_key);
  }

  private async findOwnedFile(userId: number, fileId: number) {
    const file = await this.prisma.storageFile.findFirst({
      where: { id: fileId, user_id: userId, deleted_at: null },
    });
    if (!file) throw new NotFoundException('파일을 찾을 수 없습니다.');
    return file;
  }

  private async findOwnedFolder(userId: number, folderId: number) {
    const folder = await this.prisma.storageFolder.findFirst({
      where: { id: folderId, user_id: userId, deleted_at: null },
    });
    if (!folder) throw new NotFoundException('폴더를 찾을 수 없습니다.');
    return folder;
  }
}
