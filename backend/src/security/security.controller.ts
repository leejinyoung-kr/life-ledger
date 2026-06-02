import { Controller, Get, Param, ParseIntPipe, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthUser } from '../auth/strategies/jwt.strategy';
import { SecurityService } from './security.service';

@ApiTags('보안 센터')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('security')
export class SecurityController {
  constructor(private readonly service: SecurityService) {}

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

  // 위험 요소 해결
  @Post('risks/:id/resolve')
  resolveRisk(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.service.resolveRisk(user.id, id);
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
}
