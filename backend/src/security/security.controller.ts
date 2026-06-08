import { Body, Controller, Get, Param, ParseIntPipe, Post, Query, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthUser } from '../auth/strategies/jwt.strategy';
import { AccessLogService } from '../access-log/access-log.service';
import { SecurityService } from './security.service';
import { VaultService } from './vault.service';
import { SetupVaultDto, VaultPasswordDto } from './dto/vault.dto';

@ApiTags('보안 센터')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('security')
export class SecurityController {
  constructor(
    private readonly service: SecurityService,
    private readonly accessLog: AccessLogService,
    private readonly vault: VaultService,
  ) {}

  // 요약 (점수 + 카테고리별 건수)
  @Get('summary')
  summary(@CurrentUser() user: AuthUser) {
    return this.service.summary(user.id);
  }

  // 위험 요소 목록
  @Get('risks')
  risks(@CurrentUser() user: AuthUser) {
    return this.service.risks(user.id);
  }

  // 로그인 세션 목록
  @Get('sessions')
  sessions(@CurrentUser() user: AuthUser) {
    return this.service.sessions(user.id);
  }

  // 전체 세션 로그아웃 (현재 기기 제외)
  @Post('sessions/revoke-all')
  revokeAll(@CurrentUser() user: AuthUser) {
    return this.service.revokeAll(user.id);
  }

  // 단일 세션 로그아웃/차단
  @Post('sessions/:id/revoke')
  revokeSession(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.service.revokeSession(user.id, id);
  }

  // 보안 점수 추이 (최근 days 일)
  @Get('score-trend')
  scoreTrend(@CurrentUser() user: AuthUser, @Query('days') days?: string) {
    return this.service.scoreTrend(user.id, days ? Number(days) : 30);
  }

  // 비밀번호 강도 분포 통계
  @Get('strength-stats')
  strengthStats(@CurrentUser() user: AuthUser) {
    return this.service.strengthStats(user.id);
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

  // 마스터 잠금 설정/변경
  @Post('vault/setup')
  vaultSetup(@CurrentUser() user: AuthUser, @Body() dto: SetupVaultDto) {
    return this.vault.setup(user.id, dto.password, dto.timeoutMin ?? 5);
  }

  // 마스터 잠금 해제(비활성화)
  @Post('vault/disable')
  vaultDisable(@CurrentUser() user: AuthUser, @Body() dto: VaultPasswordDto) {
    return this.vault.disable(user.id, dto.password);
  }

  // 잠금 해제 — vault 토큰 발급. 마스터 비번 무차별 대입 방지로 분당 5회 제한
  @Post('vault/unlock')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  vaultUnlock(@CurrentUser() user: AuthUser, @Body() dto: VaultPasswordDto) {
    return this.vault.unlock(user.id, dto.password);
  }
}
