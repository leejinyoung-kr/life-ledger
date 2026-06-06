import { Body, Controller, Delete, Get, Param, ParseIntPipe, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthUser } from '../auth/strategies/jwt.strategy';
import { NotificationService } from './notification.service';

@ApiTags('알림')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationController {
  constructor(private readonly service: NotificationService) {}

  // 알림 목록
  @Get()
  findAll(@CurrentUser() user: AuthUser) {
    return this.service.findAll(user.id);
  }

  // 미읽음 알림 수 (TopBar 벨 배지)
  @Get('unread-count')
  unreadCount(@CurrentUser() user: AuthUser) {
    return this.service.unreadCount(user.id);
  }

  // 전체 읽음 처리
  @Put('read-all')
  markAllRead(@CurrentUser() user: AuthUser) {
    return this.service.markAllRead(user.id);
  }

  // 단일 알림 읽음 처리
  @Put(':id/read')
  markRead(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.service.markRead(user.id, id);
  }

  // 전체 알림 삭제
  @Delete()
  removeAll(@CurrentUser() user: AuthUser) {
    return this.service.removeAll(user.id);
  }

  // 선택 알림 삭제
  @Delete('bulk')
  removeSelected(@CurrentUser() user: AuthUser, @Body('ids') ids: number[]) {
    return this.service.removeSelected(user.id, ids);
  }

  // 단일 알림 삭제
  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.service.remove(user.id, id);
  }
}
