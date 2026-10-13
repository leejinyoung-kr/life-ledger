import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@leejinyoung-kr/core-auth';
import { JwtAuthGuard } from '@leejinyoung-kr/core-auth';
import type { AuthUser } from '../auth/auth-user';
import { Client, type ClientInfo } from '@leejinyoung-kr/core-logging';
import { AccessLogService } from '../access-log/access-log.service';
import { SecurityService } from './security.service';
import { VaultService } from './vault.service';
import { VaultGuard } from './vault.guard';
import { SetupVaultDto, VaultPasswordDto } from './dto/vault.dto';

@ApiTags('보안')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('security')
export class SecurityController {
  constructor(
    private readonly service: SecurityService,
    private readonly accessLog: AccessLogService,
    private readonly vault: VaultService,
  ) {}

  // 로그인 세션 목록
  @Get('sessions')
  sessions(@CurrentUser() user: AuthUser) {
    return this.service.sessions(user.id);
  }

  // 전체 세션 로그아웃 (현재 기기 제외) — 남용 방지로 분당 10회 제한
  @Post('sessions/revoke-all')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  revokeAll(@CurrentUser() user: AuthUser, @Client() client: ClientInfo) {
    return this.service.revokeAll(user.id, client);
  }

  // 단일 세션 로그아웃/차단
  @Post('sessions/:id/revoke')
  revokeSession(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Client() client: ClientInfo,
  ) {
    return this.service.revokeSession(user.id, id, client);
  }

  // 최근 보관함 열람 기록
  @Get('access-logs')
  accessLogs(@CurrentUser() user: AuthUser, @Query('limit') limit?: string) {
    return this.accessLog.recent(user.id, limit ? Number(limit) : 50);
  }

  // 마스터 잠금 상태
  @Get('vault')
  vaultStatus(@CurrentUser() user: AuthUser) {
    return this.vault.status(user.id);
  }

  // 마스터 잠금 설정/변경 — 이미 켜져 있으면 VaultGuard 로 잠금 해제(현재 비번 확인)를 먼저 요구해 비번 덮어쓰기 우회를 막는다
  @Post('vault/setup')
  @UseGuards(VaultGuard)
  vaultSetup(@CurrentUser() user: AuthUser, @Body() dto: SetupVaultDto) {
    return this.vault.setup(user.id, dto.password, dto.timeoutMin ?? 5);
  }

  // 마스터 잠금 해제(비활성화)
  @Post('vault/disable')
  vaultDisable(@CurrentUser() user: AuthUser, @Body() dto: VaultPasswordDto, @Client() client: ClientInfo) {
    return this.vault.disable(user.id, dto.password, client);
  }

  // 잠금 해제 — vault 토큰 발급. 마스터 비번 무차별 대입 방지로 분당 5회 제한
  @Post('vault/unlock')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  vaultUnlock(@CurrentUser() user: AuthUser, @Body() dto: VaultPasswordDto, @Client() client: ClientInfo) {
    return this.vault.unlock(user.id, dto.password, client);
  }
}
