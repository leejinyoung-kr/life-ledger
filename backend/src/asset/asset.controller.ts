import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@leejinyoung-kr/core-auth';
import { JwtAuthGuard } from '@leejinyoung-kr/core-auth';
import type { AuthUser } from '../auth/auth-user';
import { AssetService } from './asset.service';

@ApiTags('자산 종합')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('assets')
export class AssetController {
  constructor(private readonly service: AssetService) {}

  // 요약 (총자산/순자산 + 증감 + 구성 + 유형별)
  @Get('summary')
  summary(@CurrentUser() user: AuthUser) {
    return this.service.summary(user.id);
  }

  // 순자산 추이 (최근 6개월)
  @Get('trend')
  trend(@CurrentUser() user: AuthUser) {
    return this.service.trend(user.id);
  }
}
