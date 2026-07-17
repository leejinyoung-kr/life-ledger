import { Controller, Get, Res, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { CurrentUser } from '@leejinyoun/core-auth';
import { JwtAuthGuard } from '@leejinyoun/core-auth';
import type { AuthUser } from '../auth/auth-user';
import { Client, type ClientInfo } from '@leejinyoun/core-logging';
import { ExportService } from './export.service';

@ApiTags('데이터 내보내기')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
// 전 데이터 백업 — 유출 공격 throttle. 전 엔드포인트 분당 5회 제한
@Throttle({ default: { limit: 5, ttl: 60000 } })
@Controller('export')
export class ExportController {
  constructor(private readonly service: ExportService) {}

  // 계정 보관함 JSON 백업 다운로드 (암호문 보존)
  @Get('credentials')
  async credentials(
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
    @Client() client: ClientInfo,
  ): Promise<void> {
    const data = await this.service.credentialsJson(user.id, client);
    const filename = encodeURIComponent('계정백업.json');
    res.set({
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="credentials.json"; filename*=UTF-8''${filename}`,
    });
    res.send(JSON.stringify(data, null, 2));
  }

  // 전체 데이터 백업 ZIP 다운로드
  @Get('backup')
  async backup(
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
    @Client() client: ClientInfo,
  ): Promise<void> {
    const buf = await this.service.backupZip(user.id, client);
    const filename = encodeURIComponent('docnexus-백업.zip');
    res.set({
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="docnexus-backup.zip"; filename*=UTF-8''${filename}`,
    });
    res.end(buf);
  }
}
