import {
  Body,
  Controller,
  Delete,
  Get,
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

// 업로드 상한 — core-storage 검증(50MB)과 같은 값
const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

@ApiTags('파일 보관함')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('files')
export class FileController {
  constructor(private readonly service: FileService) {}

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

  // ZIP 으로 받기 전 요약 — 담길 파일 수·용량, 한 번에 받을 수 있는 상한
  @Get('zip/summary')
  async zipSummary(@CurrentUser() user: AuthUser, @Query('folderId') folderId?: string) {
    const plan = await this.service.planZip(user.id, folderId ? Number(folderId) : undefined);
    return { fileCount: plan.entries.length, totalBytes: plan.totalBytes, maxBytes: ZIP_MAX_BYTES };
  }

  // 폴더(없으면 보관함 전체)를 하위 폴더까지 ZIP 하나로 내려준다 — 폴더 구조 유지
  @Get('zip')
  async zip(
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
    @Query('folderId') folderId?: string,
  ) {
    const plan = await this.service.planZip(user.id, folderId ? Number(folderId) : undefined);
    this.service.assertZippable(plan);

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', contentDisposition('attachment', `${plan.rootName ?? '파일보관함'}.zip`));
    try {
      await this.service.streamZip(user.id, plan.entries, res);
    } catch (err) {
      // 이미 ZIP 을 보내기 시작했으면 응답을 끊어 브라우저가 받다 만 파일을 실패로 보게 한다
      res.destroy(err as Error);
    }
  }

  // 비우기 전 요약 — 지울 폴더·파일 수와 용량
  @Get('clear/summary')
  async clearSummary(@CurrentUser() user: AuthUser, @Query('folderId') folderId?: string) {
    const plan = await this.service.planClear(user.id, folderId ? Number(folderId) : undefined);
    return { folderCount: plan.folderIds.length, fileCount: plan.fileIds.length, totalBytes: plan.totalBytes };
  }

  // 비우기 — 폴더(없으면 보관함 전체) 안의 하위 폴더·파일을 한 번에 지운다
  @Delete('clear')
  clear(@CurrentUser() user: AuthUser, @Query('folderId') folderId?: string) {
    return this.service.clear(user.id, folderId ? Number(folderId) : undefined);
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

  // presigned 다운로드/미리보기 URL 발급 (?disposition=inline 이면 브라우저 내 미리보기용)
  @Get(':id/url')
  async getUrl(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Query('disposition') disposition?: string,
  ) {
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
