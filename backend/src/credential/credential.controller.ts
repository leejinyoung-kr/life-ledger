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
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthUser } from '../auth/strategies/jwt.strategy';
import { CreateCredentialDto } from './dto/create-credential.dto';
import { UpdateCredentialDto } from './dto/update-credential.dto';
import { CredentialService } from './credential.service';

@ApiTags('계정 보관함')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('credentials')
export class CredentialController {
  constructor(private readonly service: CredentialService) {}

  // 계정 목록
  @Get()
  findAll(@CurrentUser() user: AuthUser) {
    return this.service.findAll(user.id);
  }

  // 빈 엑셀 양식 다운로드
  @Get('template')
  async template(@Res() res: Response): Promise<void> {
    const buf = await this.service.templateExcel();
    const filename = encodeURIComponent('계정양식.xlsx');
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="credentials-template.xlsx"; filename*=UTF-8''${filename}`,
    });
    res.end(buf);
  }

  // 계정 데이터 엑셀 다운로드 (비밀번호 평문 — 본인 백업)
  @Get('export')
  async export(@CurrentUser() user: AuthUser, @Res() res: Response): Promise<void> {
    const buf = await this.service.exportExcel(user.id);
    const filename = encodeURIComponent('계정.xlsx');
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="credentials.xlsx"; filename*=UTF-8''${filename}`,
    });
    res.end(buf);
  }

  // 엑셀 양식 업로드 → 일괄 추가 (multipart 필드명: file)
  @Post('import')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }))
  importExcel(@CurrentUser() user: AuthUser, @UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('업로드할 파일이 없습니다.');
    return this.service.importExcel(user.id, file.buffer);
  }

  // 비밀번호·TOTP 원문 조회 (표시/복사)
  @Get(':id/reveal')
  reveal(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.service.reveal(user.id, id);
  }

  // 현재 TOTP 6자리 코드 + 남은 시간
  @Get(':id/totp')
  totp(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.service.totpCode(user.id, id);
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

  // 계정 삭제
  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.service.remove(user.id, id);
  }
}
