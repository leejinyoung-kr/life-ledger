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
import { createHash, randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFolderDto, MoveFileDto } from './dto/file.dto';

const MAX_FILE_SIZE = 50 * 1024 * 1024;

// 허용 MIME 접두/타입 화이트리스트 — 실행파일·스크립트 등 위험 업로드 차단
const ALLOWED_MIME_PREFIXES = ['image/', 'video/', 'audio/', 'text/'];
const ALLOWED_MIME_EXACT = new Set([
  'application/pdf',
  'application/zip',
  'application/json',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/octet-stream',
]);
function isAllowedMime(mime: string): boolean {
  return ALLOWED_MIME_PREFIXES.some((p) => mime.startsWith(p)) || ALLOWED_MIME_EXACT.has(mime);
}

// inline 미리보기 시 브라우저가 직접 실행/렌더링하면 XSS 위험이 있는 형식 — attachment 로 강제
const INLINE_BLOCKED_MIME = new Set([
  'text/html',
  'application/xhtml+xml',
  'image/svg+xml',
  'text/xml',
  'application/xml',
]);

// ZIP 컨테이너 기반 오피스 포맷 — PK 시그니처 허용 대상
const ZIP_FAMILY_MIME = new Set([
  'application/zip',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
]);

// 레거시 OLE 복합문서 기반 오피스 포맷 — D0CF11E0 시그니처 허용 대상
const OLE_FAMILY_MIME = new Set([
  'application/msword',
  'application/vnd.ms-excel',
  'application/vnd.ms-powerpoint',
]);

function startsWithBytes(buf: Buffer, sig: number[]): boolean {
  return buf.length >= sig.length && sig.every((b, i) => buf[i] === b);
}

// 매직바이트 시그니처 → 선언 mimetype 허용 여부 검사 규칙.
// 시그니처가 매칭되는데 declared mime 이 허용되지 않으면 위장 업로드로 간주해 차단.
const MAGIC_RULES: { test: (buf: Buffer) => boolean; allow: (mime: string) => boolean }[] = [
  { test: (b) => startsWithBytes(b, [0xff, 0xd8, 0xff]), allow: (m) => m === 'image/jpeg' },
  { test: (b) => startsWithBytes(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), allow: (m) => m === 'image/png' },
  { test: (b) => startsWithBytes(b, [0x47, 0x49, 0x46, 0x38]), allow: (m) => m === 'image/gif' },
  {
    test: (b) => startsWithBytes(b, [0x52, 0x49, 0x46, 0x46]) && b.subarray(8, 12).toString('ascii') === 'WEBP',
    allow: (m) => m === 'image/webp',
  },
  {
    test: (b) => startsWithBytes(b, [0x52, 0x49, 0x46, 0x46]) && b.subarray(8, 12).toString('ascii') === 'WAVE',
    allow: (m) => m === 'audio/wav' || m === 'audio/x-wav' || m === 'audio/wave',
  },
  { test: (b) => startsWithBytes(b, [0x25, 0x50, 0x44, 0x46]), allow: (m) => m === 'application/pdf' },
  {
    test: (b) => startsWithBytes(b, [0x50, 0x4b, 0x03, 0x04]) || startsWithBytes(b, [0x50, 0x4b, 0x05, 0x06]),
    allow: (m) => ZIP_FAMILY_MIME.has(m),
  },
  { test: (b) => startsWithBytes(b, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]), allow: (m) => OLE_FAMILY_MIME.has(m) },
  { test: (b) => startsWithBytes(b, [0x49, 0x44, 0x33]), allow: (m) => m === 'audio/mpeg' },
  { test: (b) => b.length >= 2 && b[0] === 0xff && (b[1] & 0xe0) === 0xe0, allow: (m) => m === 'audio/mpeg' },
  {
    test: (b) => b.length >= 12 && b.subarray(4, 8).toString('ascii') === 'ftyp',
    allow: (m) => m.startsWith('video/') || m.startsWith('audio/'),
  },
  { test: (b) => startsWithBytes(b, [0x1a, 0x45, 0xdf, 0xa3]), allow: (m) => m === 'video/webm' || m === 'video/x-matroska' },
  // 실행파일 시그니처 — 선언 형식과 무관하게 항상 차단
  { test: (b) => startsWithBytes(b, [0x4d, 0x5a]), allow: () => false },
  { test: (b) => startsWithBytes(b, [0x7f, 0x45, 0x4c, 0x46]), allow: () => false },
  {
    test: (b) =>
      startsWithBytes(b, [0xfe, 0xed, 0xfa, 0xce]) ||
      startsWithBytes(b, [0xfe, 0xed, 0xfa, 0xcf]) ||
      startsWithBytes(b, [0xcf, 0xfa, 0xed, 0xfe]) ||
      startsWithBytes(b, [0xce, 0xfa, 0xed, 0xfe]),
    allow: () => false,
  },
];

// 매직바이트로 실제 형식을 판별해 declared mimetype 과 비교 — 알려진 시그니처가 없으면 통과(text/* 등)
function checkMagicBytes(buf: Buffer, declaredMime: string): void {
  for (const rule of MAGIC_RULES) {
    if (rule.test(buf)) {
      if (!rule.allow(declaredMime)) {
        throw new BadRequestException('파일 내용이 선언된 형식과 일치하지 않습니다.');
      }
      return;
    }
  }
}

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

  // 파일 업로드 — MIME 화이트리스트 검증 + SHA-256 중복 제거 후 B2 저장·DB 기록.
  // 동일 내용(해시 일치) 파일이 이미 있으면 B2 재업로드 없이 기존 오브젝트를 가리키는 메타만 추가한다.
  async upload(userId: number, file: Express.Multer.File, folderId?: number) {
    if (file.size > MAX_FILE_SIZE)
      throw new BadRequestException('파일 크기는 50MB를 초과할 수 없습니다.');
    if (!isAllowedMime(file.mimetype))
      throw new BadRequestException(`허용되지 않는 파일 형식입니다: ${file.mimetype}`);
    checkMagicBytes(file.buffer, file.mimetype);

    if (folderId) await this.findOwnedFolder(userId, folderId);

    // multer가 원본 파일명을 latin1로 디코딩하므로 한글 등 비ASCII 파일명은 utf8로 재해석
    const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
    const hash = createHash('sha256').update(file.buffer).digest('hex');

    // 동일 내용 파일이 이미 있으면 그 오브젝트 키를 재사용 (B2 업로드/저장 비용 절감)
    const dup = await this.prisma.storageFile.findFirst({
      where: { user_id: userId, hash, deleted_at: null },
    });
    const ext = originalName.split('.').pop() ?? '';
    const objectKey = dup?.object_key ?? `users/${userId}/${randomUUID()}${ext ? '.' + ext : ''}`;

    if (!dup) {
      await this.s3.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: objectKey,
          Body: file.buffer,
          ContentType: file.mimetype,
          ContentLength: file.size,
        }),
      );
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
        await this.s3.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: objectKey })).catch(() => {});
      }
      throw e;
    }

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

  // presigned 다운로드/미리보기 URL 발급 (5분 유효)
  // disposition: 'attachment'면 다운로드, 'inline'이면 브라우저 내 미리보기
  // text/html·image/svg+xml 등 inline 렌더링 시 XSS 위험이 있는 형식은 attachment 로 강제 전환
  async getDownloadUrl(userId: number, fileId: number, disposition: 'attachment' | 'inline' = 'attachment') {
    const file = await this.findOwnedFile(userId, fileId);
    const safeDisposition = disposition === 'inline' && INLINE_BLOCKED_MIME.has(file.mime_type) ? 'attachment' : disposition;
    const url = await getSignedUrl(
      this.s3,
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: file.object_key,
        ResponseContentDisposition: `${safeDisposition}; filename="${encodeURIComponent(file.name)}"`,
      }),
      { expiresIn: 300 },
    );
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
      await this.s3.send(
        new DeleteObjectCommand({ Bucket: this.bucket, Key: file.object_key }),
      );
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
