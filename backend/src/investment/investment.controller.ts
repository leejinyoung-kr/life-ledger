import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthUser } from '../auth/strategies/jwt.strategy';
import { CreateInvestmentDto } from './dto/create-investment.dto';
import { UpdateInvestmentDto } from './dto/update-investment.dto';
import { InvestmentService } from './investment.service';

@ApiTags('가계부 - 투자')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('investments')
export class InvestmentController {
  constructor(private readonly service: InvestmentService) {}

  // 요약 (총 평가금액/원금/수익/수익률)
  @Get('summary')
  summary(@CurrentUser() user: AuthUser) {
    return this.service.summary(user.id);
  }

  // 투자 목록
  @Get()
  findAll(@CurrentUser() user: AuthUser) {
    return this.service.findAll(user.id);
  }

  // 투자 추가
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateInvestmentDto) {
    return this.service.create(user.id, dto);
  }

  // 투자 수정
  @Put(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateInvestmentDto,
  ) {
    return this.service.update(user.id, id, dto);
  }

  // 투자 일괄 삭제
  @Delete('bulk')
  removeMany(@CurrentUser() user: AuthUser, @Body('ids') ids: number[]) {
    return this.service.removeMany(user.id, ids);
  }

  // 투자 삭제
  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.service.remove(user.id, id);
  }
}
