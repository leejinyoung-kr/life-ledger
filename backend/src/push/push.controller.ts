import { Body, Controller, Get, Headers, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@leejinyoung-kr/core-auth';
import type { AuthUser } from '../auth/auth-user';
import { SubscribeDto, UnsubscribeDto } from './dto/subscribe.dto';
import { PushService } from './push.service';

@ApiTags('푸시')
@ApiBearerAuth()
@Controller('push')
export class PushController {
  constructor(private readonly service: PushService) {}

  // 구독 전 VAPID 공개키 + 활성여부 조회 (키 없으면 enabled=false)
  @ApiOperation({ summary: 'VAPID 공개키 조회' })
  @Get('public-key')
  getPublicKey() {
    return this.service.getPublicKey();
  }

  // 브라우저 푸시 구독 등록
  @ApiOperation({ summary: '웹 푸시 구독 등록' })
  @Post('subscribe')
  subscribe(
    @CurrentUser() user: AuthUser,
    @Body() dto: SubscribeDto,
    @Headers('user-agent') ua?: string,
  ) {
    return this.service.subscribe(user.id, dto, ua);
  }

  // 브라우저 푸시 구독 해제
  @ApiOperation({ summary: '웹 푸시 구독 해제' })
  @Post('unsubscribe')
  unsubscribe(@CurrentUser() user: AuthUser, @Body() dto: UnsubscribeDto) {
    return this.service.unsubscribe(user.id, dto.endpoint);
  }

  // 본인에게 테스트 푸시 발송 (발송 동작 확인용)
  @ApiOperation({ summary: '테스트 푸시 발송' })
  @Post('test')
  sendTest(@CurrentUser() user: AuthUser) {
    return this.service.sendTest(user.id);
  }
}
