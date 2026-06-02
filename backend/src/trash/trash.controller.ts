import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthUser } from '../auth/strategies/jwt.strategy';
import { TrashActionDto } from './dto/trash-action.dto';
import { TrashService } from './trash.service';

@ApiTags('휴지통')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('trash')
export class TrashController {
  constructor(private readonly service: TrashService) {}

  // 전체 삭제 항목 통합 목록
  @Get()
  findAll(@CurrentUser() user: AuthUser) {
    return this.service.findAll(user.id);
  }

  // 단일 복구
  @Post('restore')
  restore(@CurrentUser() user: AuthUser, @Body() dto: TrashActionDto) {
    return this.service.restore(user.id, dto.kind, dto.id);
  }

  // 단일 영구 삭제
  @Post('purge')
  purge(@CurrentUser() user: AuthUser, @Body() dto: TrashActionDto) {
    return this.service.purge(user.id, dto.kind, dto.id);
  }

  // 전체 복구
  @Post('restore-all')
  restoreAll(@CurrentUser() user: AuthUser) {
    return this.service.restoreAll(user.id);
  }

  // 휴지통 비우기
  @Post('empty')
  empty(@CurrentUser() user: AuthUser) {
    return this.service.empty(user.id);
  }
}
