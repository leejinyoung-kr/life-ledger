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
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { CurrentUser } from '@leejinyoun/core-auth';
import { JwtAuthGuard } from '@leejinyoun/core-auth';
import type { AuthUser } from '../auth/auth-user';
import { CreateFolderDto, MoveFileDto } from './dto/file.dto';
import { FileService } from './file.service';

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

  // 파일 업로드 (multipart/form-data)
  @Post('upload')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  upload(
    @CurrentUser() user: AuthUser,
    @UploadedFile() file: Express.Multer.File,
    @Query('folderId') folderId?: string,
  ) {
    return this.service.upload(user.id, file, folderId ? Number(folderId) : undefined);
  }

  // presigned 다운로드/미리보기 URL 발급 (?disposition=inline 이면 브라우저 내 미리보기용)
  @Get(':id/url')
  getUrl(
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

  // 폴더 삭제 (하위 트리 전체 soft delete)
  @Delete('folders/:id')
  removeFolder(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.service.removeFolder(user.id, id);
  }
}
