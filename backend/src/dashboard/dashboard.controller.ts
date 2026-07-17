import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@leejinyoun/core-auth';
import { JwtAuthGuard } from '@leejinyoun/core-auth';
import type { AuthUser } from '../auth/auth-user';
import { DashboardService } from './dashboard.service';

@ApiTags('대시보드')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly service: DashboardService) {}

  // 대시보드 요약
  @Get('summary')
  summary(@CurrentUser() user: AuthUser) {
    return this.service.summary(user.id);
  }

  // 현금흐름 예측 (다음 달 고정지출)
  @Get('cashflow-forecast')
  cashflowForecast(@CurrentUser() user: AuthUser) {
    return this.service.cashflowForecast(user.id);
  }

  // 통합 D-day 보드 (만료·만기·결제·마감)
  @Get('deadlines')
  deadlines(@CurrentUser() user: AuthUser) {
    return this.service.deadlines(user.id);
  }
}
