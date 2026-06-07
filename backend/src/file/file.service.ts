import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFolderDto, MoveFileDto } from './dto/file.dto';

const MAX_FILE_SIZE = 50 * 1024 * 1024;

@Injectable()
export class FileService {
  private readonly s3: S3Client;
  private readonly bucket: string;

  constructor(private prisma: PrismaService) {
    this.bucket = process.env.B2_BUCKET_NAME!;
    this.s3 = new S3Client({
      endpoint: process.env.B2_ENDPOINT!,
      region: process.env.B2_BUCKET_REGION!,
      credentials: {
        accessKeyId: process.env.B2_KEY_ID!,
        secretAccessKey: process.env.B2_APPLICATION_KEY!,
      },
      forcePathStyle: true,
    });
  }

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

  // 파일 업로드 — B2에 저장 후 메타데이터를 DB에 기록
  async upload(userId: number, file: Express.Multer.File, folderId?: number) {
    if (file.size > MAX_FILE_SIZE)
      throw new BadRequestException('파일 크기는 50MB를 초과할 수 없습니다.');

    if (folderId) await this.findOwnedFolder(userId, folderId);

    // multer가 원본 파일명을 latin1로 디코딩하므로 한글 등 비ASCII 파일명은 utf8로 재해석
    const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
    const ext = originalName.split('.').pop() ?? '';
    const objectKey = `users/${userId}/${randomUUID()}${ext ? '.' + ext : ''}`;

    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: objectKey,
        Body: file.buffer,
        ContentType: file.mimetype,
        ContentLength: file.size,
      }),
    );

    const saved = await this.prisma.storageFile.create({
      data: {
        user_id: userId,
        folder_id: folderId ?? null,
        object_key: objectKey,
        name: originalName,
        size: file.size,
        mime_type: file.mimetype,
      },
    });

    return {
      id: saved.id,
      name: saved.name,
      size: Number(saved.size),
      mimeType: saved.mime_type,
      folderId: saved.folder_id,
      createdAt: saved.created_at.toISOString(),
    };
  }

  // presigned 다운로드/미리보기 URL 발급 (5분 유효)
  // disposition: 'attachment'면 다운로드, 'inline'이면 브라우저 내 미리보기
  async getDownloadUrl(userId: number, fileId: number, disposition: 'attachment' | 'inline' = 'attachment') {
    const file = await this.findOwnedFile(userId, fileId);
    const url = await getSignedUrl(
      this.s3,
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: file.object_key,
        ResponseContentDisposition: `${disposition}; filename="${encodeURIComponent(file.name)}"`,
      }),
      { expiresIn: 300 },
    );
    return { url };
  }

  // 파일 삭제 — B2 오브젝트 삭제 + DB soft delete
  async removeFile(userId: number, fileId: number) {
    const file = await this.findOwnedFile(userId, fileId);

    await this.s3.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: file.object_key }),
    );

    await this.prisma.storageFile.update({
      where: { id: fileId },
      data: { deleted_at: new Date() },
    });

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

  // 하위 트리를 BFS로 순회하며 모두 soft delete
  private async deleteFolderRecursive(userId: number, folderId: number) {
    const now = new Date();
    const queue = [folderId];

    while (queue.length > 0) {
      const current = queue.shift()!;

      const children = await this.prisma.storageFolder.findMany({
        where: { user_id: userId, parent_id: current, deleted_at: null },
        select: { id: true },
      });
      children.forEach((c) => queue.push(c.id));

      await this.prisma.$transaction([
        this.prisma.storageFile.updateMany({
          where: { user_id: userId, folder_id: current, deleted_at: null },
          data: { deleted_at: now },
        }),
        this.prisma.storageFolder.update({
          where: { id: current },
          data: { deleted_at: now },
        }),
      ]);
    }
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
