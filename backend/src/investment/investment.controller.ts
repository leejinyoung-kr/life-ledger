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
import { CreateInvestmentDto } from './dto/create-investment.dto';
import { QueryInvestmentDto } from './dto/query-investment.dto';
import { UpdateInvestmentDto } from './dto/update-investment.dto';
import { TradeInvestmentDto } from './dto/trade-investment.dto';
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

  // USD/KRW 현재 환율 — 해외투자 USD 표기 토글용
  @Get('exchange-rate')
  exchangeRate() {
    return this.service.getExchangeRate();
  }

  // 투자 목록 (유형/종목명 필터 + 페이지네이션)
  @Get()
  findAll(@CurrentUser() user: AuthUser, @Query() query: QueryInvestmentDto) {
    return this.service.findAll(user.id, query);
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

  // 시세조회 — 등록된 종목코드/티커로 현재가 조회 (국내: 네이버, 해외: 야후+환율)
  @Get(':id/price')
  lookupPrice(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.service.lookupPrice(user.id, id);
  }

  // 시세조회(단가만) — 매수/매도 모달에서 단가 자동입력에 사용
  @Get(':id/quote')
  quote(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.service.quote(user.id, id);
  }

  // 매수 — 예수금 → 투자원금·평가금액 전환
  @Post(':id/buy')
  buy(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: TradeInvestmentDto,
  ) {
    return this.service.buy(user.id, id, dto);
  }

  // 매도 — 평가금액 → 예수금 환입
  @Post(':id/sell')
  sell(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: TradeInvestmentDto,
  ) {
    return this.service.sell(user.id, id, dto);
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
