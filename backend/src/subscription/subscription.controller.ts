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
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { QuerySubscriptionDto } from './dto/query-subscription.dto';
import { UpdateSubscriptionDto } from './dto/update-subscription.dto';
import { SubscriptionService } from './subscription.service';

@ApiTags('구독 관리')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('subscriptions')
export class SubscriptionController {
  constructor(private readonly service: SubscriptionService) {}

  // 요약 (월 구독료/연 환산/활성 수/다음 결제까지)
  @Get('summary')
  summary(@CurrentUser() user: AuthUser) {
    return this.service.summary(user.id);
  }

  // 미사용 의심 구독
  @Get('unused')
  unused(@CurrentUser() user: AuthUser) {
    return this.service.unused(user.id);
  }

  // 구독 목록 (서비스명/카테고리 검색 + 페이지네이션)
  @Get()
  findAll(@CurrentUser() user: AuthUser, @Query() query: QuerySubscriptionDto) {
    return this.service.findAll(user.id, query);
  }

  // 구독 추가
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateSubscriptionDto) {
    return this.service.create(user.id, dto);
  }

  // 구독 수정
  @Put(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateSubscriptionDto,
  ) {
    return this.service.update(user.id, id, dto);
  }

  // 구독 해지
  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.service.remove(user.id, id);
  }
}
