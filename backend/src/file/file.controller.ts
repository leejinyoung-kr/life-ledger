import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpException,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import type { Response } from 'express';
import { contentDisposition } from '@leejinyoung-kr/core-storage';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { CurrentUser } from '@leejinyoung-kr/core-auth';
import { JwtAuthGuard } from '@leejinyoung-kr/core-auth';
import type { AuthUser } from '../auth/auth-user';
import { CreateFolderDto, MoveFileDto } from './dto/file.dto';
import { FileService, ZIP_MAX_BYTES } from './file.service';
import { VaultService } from '../security/vault.service';

// 업로드 상한 — core-storage 검증(50MB)과 같은 값
const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

@ApiTags('파일 보관함')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('files')
export class FileController {
  constructor(
    private readonly service: FileService,
    private readonly vault: VaultService,
  ) {}

  // 현재 폴더의 하위 폴더·파일 + 브레드크럼 + 전체 사용량
  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query('folderId') folderId?: string,
  ) {
    return this.service.list(user.id, folderId ? Number(folderId) : undefined);
  }

  // 이름으로 모든 폴더 검색 (폴더·파일, 위치 포함)
  @Get('search')
  search(@CurrentUser() user: AuthUser, @Query('q') q = '') {
    return this.service.search(user.id, q);
  }

  // ZIP 으로 받기 전 요약 — 담길 파일 수·용량, 잠겨서 빠질 파일 수, 한 번에 받을 수 있는 상한
  @Get('zip/summary')
  async zipSummary(
    @CurrentUser() user: AuthUser,
    @Query('folderId') folderId?: string,
    @Headers('x-vault-token') vaultToken?: string,
  ) {
    const plan = await this.service.planZip(user.id, folderId ? Number(folderId) : undefined, await this.isUnlocked(user.id, vaultToken));
    return { fileCount: plan.entries.length, totalBytes: plan.totalBytes, skippedLocked: plan.skippedLocked, maxBytes: ZIP_MAX_BYTES };
  }

  // 폴더(없으면 보관함 전체)를 하위 폴더까지 ZIP 하나로 내려준다 — 폴더 구조 유지, 잠긴 파일은 잠금이 풀렸을 때만
  @Get('zip')
  async zip(
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
    @Query('folderId') folderId?: string,
    @Headers('x-vault-token') vaultToken?: string,
  ) {
    const plan = await this.service.planZip(user.id, folderId ? Number(folderId) : undefined, await this.isUnlocked(user.id, vaultToken));
    this.service.assertZippable(plan);

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', contentDisposition('attachment', `${plan.rootName ?? '파일보관함'}.zip`));
    res.setHeader('X-Skipped-Locked', String(plan.skippedLocked));
    try {
      await this.service.streamZip(user.id, plan.entries, res);
    } catch (err) {
      // 이미 ZIP 을 보내기 시작했으면 응답을 끊어 브라우저가 받다 만 파일을 실패로 보게 한다
      res.destroy(err as Error);
    }
  }

  // 마스터 잠금이 꺼져 있거나 유효한 잠금 해제 토큰이 있는지 (잠김이면 false — 예외를 던지지 않는다)
  private async isUnlocked(userId: number, vaultToken?: string): Promise<boolean> {
    try {
      await this.vault.assertUnlocked(userId, vaultToken);
      return true;
    } catch (e) {
      if (e instanceof HttpException && e.getStatus() === HttpStatus.LOCKED) return false;
      throw e;
    }
  }

  // 파일 업로드 (multipart/form-data). 크기 상한을 multer 에도 걸어 큰 파일을 메모리에 다 받기 전에 끊는다.
  // path(예: "보험/2026")를 주면 folderId 아래에 그 폴더들을 찾거나 만들어 넣는다 — 폴더째 업로드
  @Post('upload')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: MAX_UPLOAD_BYTES } }))
  upload(
    @CurrentUser() user: AuthUser,
    @UploadedFile() file: Express.Multer.File,
    @Query('folderId') folderId?: string,
    @Query('path') relDir?: string,
  ) {
    return this.service.upload(user.id, file, folderId ? Number(folderId) : undefined, relDir || undefined);
  }

  // presigned 다운로드/미리보기 URL 발급 (?disposition=inline 이면 브라우저 내 미리보기용).
  // 신원 지갑 사본으로 연결된 파일은 보관함 민감정보라 마스터 잠금 해제를 요구한다
  @Get(':id/url')
  async getUrl(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Query('disposition') disposition?: string,
    @Headers('x-vault-token') vaultToken?: string,
  ) {
    if (await this.service.isIdentityAttachment(user.id, id)) {
      await this.vault.assertUnlocked(user.id, vaultToken);
    }
    return this.service.getDownloadUrl(user.id, id, disposition === 'inline' ? 'inline' : 'attachment');
  }

  // 파일 폴더 이동
  @Patch(':id/move')
  move(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: MoveFileDto,
  ) {
    return this.service.moveFile(user.id, id, dto);
  }

  // 파일 삭제
  @Delete(':id')
  removeFile(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.service.removeFile(user.id, id);
  }

  // 폴더 생성 (parentId 없으면 루트)
  @Post('folders')
  createFolder(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateFolderDto,
  ) {
    return this.service.createFolder(user.id, dto);
  }

  // 폴더 삭제 (하위 트리 전체 soft delete + 남는 데 없는 B2 오브젝트 삭제)
  @Delete('folders/:id')
  removeFolder(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.service.removeFolder(user.id, id);
  }
}
