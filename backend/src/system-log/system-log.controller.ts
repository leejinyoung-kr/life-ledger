import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, JwtAuthGuard } from '@leejinyoung-kr/core-auth';
import type { AuthUser } from '../auth/auth-user';
import { SystemLogService } from './system-log.service';

@ApiTags('시스템 로그')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('system-logs')
export class SystemLogController {
  constructor(private readonly service: SystemLogService) {}

  // 시스템 로그 목록 (본인 + 전역 작업 로그, 필터·페이지네이션)
  @Get()
  findAll(
    @CurrentUser() user: AuthUser,
    @Query('level') level?: string,
    @Query('category') category?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('q') q?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.findAll(user.id, {
      level,
      category,
      from,
      to,
      q,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }
}
