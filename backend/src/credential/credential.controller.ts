import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { CurrentUser } from '@leejinyoun/core-auth';
import { JwtAuthGuard } from '@leejinyoun/core-auth';
import { VaultGuard } from '../security/vault.guard';
import type { AuthUser } from '../auth/auth-user';
import { Client, type ClientInfo } from '@leejinyoun/core-logging';
import { CreateCredentialDto } from './dto/create-credential.dto';
import { QueryCredentialDto } from './dto/query-credential.dto';
import { UpdateCredentialDto } from './dto/update-credential.dto';
import { CredentialService } from './credential.service';

@ApiTags('계정 보관함')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('credentials')
export class CredentialController {
  constructor(private readonly service: CredentialService) {}

  // 계정 목록 (검색어/카테고리 필터 + 페이지네이션. page 지정 시 no2fa 집계 포함)
  @Get()
  findAll(@CurrentUser() user: AuthUser, @Query() query: QueryCredentialDto) {
    return this.service.findAll(user.id, query);
  }

  // 빈 엑셀 양식 다운로드
  @Get('template')
  async template(@Res() res: Response): Promise<void> {
    const buf = await this.service.templateExcel();
    const filename = encodeURIComponent('계정양식.xlsx');
    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="credentials-template.xlsx"; filename*=UTF-8''${filename}`,
    });
    res.end(buf);
  }

  // 계정 데이터 엑셀 다운로드 (비밀번호 평문 — 본인 백업). 평문 유출 공격 방지로 분당 5회 제한
  @Get('export')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async export(
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ): Promise<void> {
    const buf = await this.service.exportExcel(user.id);
    const filename = encodeURIComponent('계정.xlsx');
    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="credentials.xlsx"; filename*=UTF-8''${filename}`,
    });
    res.end(buf);
  }

  // 단일 계정 조회 (목록 DTO 형태) — 보안센터 ?focus=<id> 딥링크 등에서 사용.
  // 정적 경로(template/export) 뒤에 선언해 단일 세그먼트 id 만 매칭한다.
  @Get(':id')
  findOne(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(user.id, id);
  }

  // 엑셀 양식 업로드 → 일괄 추가 (multipart 필드명: file)
  @Post('import')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }),
  )
  importExcel(
    @CurrentUser() user: AuthUser,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('업로드할 파일이 없습니다.');
    return this.service.importExcel(user.id, file.buffer);
  }

  // 비밀번호·TOTP 원문 조회 (표시/복사). 마스터 잠금 시 VaultGuard 통과 필요. 무차별 조회 방지로 분당 20회 제한
  @Get(':id/reveal')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @UseGuards(VaultGuard)
  reveal(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Client() client: ClientInfo,
  ) {
    return this.service.reveal(user.id, id, client);
  }

  // 현재 TOTP 6자리 코드 + 남은 시간
  @Get(':id/totp')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @UseGuards(VaultGuard)
  totp(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Client() client: ClientInfo,
  ) {
    return this.service.totpCode(user.id, id, client);
  }

  // 2FA 백업코드 생성 (기존 코드 덮어씀) — 평문 코드 1회 반환
  @Post(':id/backup-codes')
  @UseGuards(VaultGuard)
  generateBackupCodes(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Client() client: ClientInfo,
  ) {
    return this.service.generateBackupCodes(user.id, id, undefined, client);
  }

  // 저장된 2FA 백업코드 조회
  @Get(':id/backup-codes')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @UseGuards(VaultGuard)
  revealBackupCodes(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Client() client: ClientInfo,
  ) {
    return this.service.revealBackupCodes(user.id, id, client);
  }

  // 2FA 백업코드 삭제
  @Delete(':id/backup-codes')
  clearBackupCodes(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.service.clearBackupCodes(user.id, id);
  }

  // 계정 추가
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateCredentialDto) {
    return this.service.create(user.id, dto);
  }

  // 계정 수정
  @Put(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCredentialDto,
  ) {
    return this.service.update(user.id, id, dto);
  }

  // 계정 일괄 삭제
  @Delete('bulk')
  removeMany(@CurrentUser() user: AuthUser, @Body('ids') ids: number[]) {
    return this.service.removeMany(user.id, ids);
  }

  // 계정 삭제
  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.service.remove(user.id, id);
  }
}
