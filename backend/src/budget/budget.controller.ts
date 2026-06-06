import { Body, Controller, Delete, Get, HttpCode, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthUser } from '../auth/strategies/jwt.strategy';
import { BudgetService } from './budget.service';
import { UpsertBudgetsDto } from './dto/upsert-budgets.dto';

@ApiTags('예산')
@ApiBearerAuth()
@Controller('budget')
export class BudgetController {
  constructor(private readonly service: BudgetService) {}

  @ApiOperation({ summary: '월별 예산 현황 (기본값 + 오버라이드 + 이월 + 지출 비교)' })
  @ApiQuery({ name: 'month', type: String, example: '2026-06' })
  @Get('status')
  getStatus(@CurrentUser() user: AuthUser, @Query('month') month: string) {
    return this.service.getMonthStatus(user.id, month);
  }

  @ApiOperation({ summary: '최근 6개월 예산 히스토리' })
  @Get('history')
  getHistory(@CurrentUser() user: AuthUser) {
    return this.service.getHistory(user.id);
  }

  @ApiOperation({ summary: '특정 달 예산 오버라이드 저장 (amount=0이면 오버라이드 제거)' })
  @Post()
  upsert(@CurrentUser() user: AuthUser, @Body() dto: UpsertBudgetsDto) {
    return this.service.upsertBudgets(user.id, dto);
  }

  @ApiOperation({ summary: '전달 잔여 예산 이월 적용' })
  @ApiQuery({ name: 'month', type: String, example: '2026-06' })
  @Post('carryover')
  @HttpCode(200)
  async applyCarryover(@CurrentUser() user: AuthUser, @Query('month') month: string) {
    await this.service.applyCarryover(user.id, month);
    return { ok: true };
  }

  @ApiOperation({ summary: '이월 초기화' })
  @ApiQuery({ name: 'month', type: String, example: '2026-06' })
  @Delete('carryover')
  @HttpCode(200)
  async resetCarryover(@CurrentUser() user: AuthUser, @Query('month') month: string) {
    await this.service.resetCarryover(user.id, month);
    return { ok: true };
  }
}
