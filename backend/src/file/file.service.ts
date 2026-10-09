import { Injectable, NotFoundException } from '@nestjs/common';
import { StorageService } from '@leejinyoung-kr/core-storage';
import { createHash, randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';
import { CreateFolderDto, MoveFileDto } from './dto/file.dto';
import { SystemLogService } from '../system-log/system-log.service';

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

  // 파일 업로드 — MIME 화이트리스트 검증 + SHA-256 중복 제거 후 B2 저장·DB 기록.
  // 동일 내용(해시 일치) 파일이 이미 있으면 B2 재업로드 없이 기존 오브젝트를 가리키는 메타만 추가한다.
  async upload(userId: number, file: Express.Multer.File, folderId?: number) {
    this.storage.validateUpload(file);

    if (folderId) await this.findOwnedFolder(userId, folderId);

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
  // 이 파일이 본인 신원 지갑 카드의 사본으로 연결돼 있는지 (마스터 잠금 대상 판별)
  async isIdentityAttachment(userId: number, fileId: number): Promise<boolean> {
    const linked = await this.prisma.identityCard.count({
      where: { user_id: userId, file_id: fileId, deleted_at: null },
    });
    return linked > 0;
  }

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

  // 폴더 삭제 — 하위 폴더/파일 재귀 soft delete
  async removeFolder(userId: number, folderId: number) {
    await this.findOwnedFolder(userId, folderId);
    await this.deleteFolderRecursive(userId, folderId);
    return { id: folderId };
  }

  // BFS로 하위 폴더 id 전부 수집 후, 폴더·파일 soft delete를 단일 트랜잭션으로 일괄 처리
  private async deleteFolderRecursive(userId: number, folderId: number) {
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
