import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthUser } from '../auth/strategies/jwt.strategy';
import { SearchService } from './search.service';

@ApiTags('통합 검색')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('search')
export class SearchController {
  constructor(private readonly service: SearchService) {}

  // 통합 검색 — GET /search?q=
  @Get()
  search(@CurrentUser() user: AuthUser, @Query('q') q = '') {
    return this.service.search(user.id, q);
  }
}
