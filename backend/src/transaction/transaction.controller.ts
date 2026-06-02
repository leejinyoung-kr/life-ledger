import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthUser } from '../auth/strategies/jwt.strategy';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { QueryTransactionDto } from './dto/query-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { TransactionService } from './transaction.service';

@ApiTags('가계부 - 수입/지출')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('transactions')
export class TransactionController {
  constructor(private readonly service: TransactionService) {}

  // 월 요약 (수입/지출/저축이동/잔액)
  @Get('summary')
  summary(@CurrentUser() user: AuthUser, @Query('month') month?: string) {
    return this.service.summary(user.id, month);
  }

  // 월별 지출 추이 (최근 5개월)
  @Get('monthly-trend')
  monthlyTrend(@CurrentUser() user: AuthUser, @Query('month') month?: string) {
    return this.service.monthlyTrend(user.id, month);
  }

  // 반복 거래 목록
  @Get('recurring')
  recurring(@CurrentUser() user: AuthUser) {
    return this.service.recurring(user.id);
  }

  // 내역 목록 (필터)
  @Get()
  findAll(@CurrentUser() user: AuthUser, @Query() query: QueryTransactionDto) {
    return this.service.findAll(user.id, query);
  }

  // 내역 추가
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateTransactionDto) {
    return this.service.create(user.id, dto);
  }

  // 내역 수정
  @Put(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTransactionDto,
  ) {
    return this.service.update(user.id, id, dto);
  }

  // 내역 삭제
  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.service.remove(user.id, id);
  }
}
