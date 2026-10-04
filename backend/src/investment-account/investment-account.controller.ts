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
import { CurrentUser } from '@leejinyoung-kr/core-auth';
import { JwtAuthGuard } from '@leejinyoung-kr/core-auth';
import type { AuthUser } from '../auth/auth-user';
import { CreateInvestmentAccountDto } from './dto/create-investment-account.dto';
import { QueryInvestmentAccountDto } from './dto/query-investment-account.dto';
import { UpdateInvestmentAccountDto } from './dto/update-investment-account.dto';
import { ExchangeInvestmentAccountDto } from './dto/exchange-investment-account.dto';
import { InvestmentAccountService } from './investment-account.service';

@ApiTags('가계부 - 투자 계좌')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('investment-accounts')
export class InvestmentAccountController {
  constructor(private readonly service: InvestmentAccountService) {}

  // 요약 (총 예수금/계좌 수)
  @Get('summary')
  summary(@CurrentUser() user: AuthUser) {
    return this.service.summary(user.id);
  }

  // 계좌 목록 (계좌명 검색 + 페이지네이션)
  @Get()
  findAll(@CurrentUser() user: AuthUser, @Query() query: QueryInvestmentAccountDto) {
    return this.service.findAll(user.id, query);
  }

  // 계좌 추가
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateInvestmentAccountDto) {
    return this.service.create(user.id, dto);
  }

  // 계좌 수정
  @Put(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateInvestmentAccountDto,
  ) {
    return this.service.update(user.id, id, dto);
  }

  // 환전 (원화↔달러 계좌 내 전환)
  @Post(':id/exchange')
  exchange(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ExchangeInvestmentAccountDto,
  ) {
    return this.service.exchange(user.id, id, dto);
  }

  // 계좌 삭제
  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.service.remove(user.id, id);
  }
}
