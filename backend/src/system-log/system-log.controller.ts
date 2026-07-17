import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '@leejinyoun/core-auth';
import { SystemLogService } from './system-log.service';

@ApiTags('시스템 로그')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('system-logs')
export class SystemLogController {
  constructor(private readonly service: SystemLogService) {}

  @Get()
  findAll(
    @Query('level') level?: string,
    @Query('category') category?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('q') q?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.findAll({
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
