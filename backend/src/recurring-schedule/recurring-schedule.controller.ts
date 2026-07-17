import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@leejinyoun/core-auth';
import { JwtAuthGuard } from '@leejinyoun/core-auth';
import type { AuthUser } from '../auth/auth-user';
import { CreateRecurringScheduleDto } from './dto/create-recurring-schedule.dto';
import { QueryRecurringScheduleDto } from './dto/query-recurring-schedule.dto';
import { UpdateRecurringScheduleDto } from './dto/update-recurring-schedule.dto';
import { RecurringScheduleService } from './recurring-schedule.service';

// 자동이체 설정 — 반복거래/반복매수 데이터는 여기서 등록한 규칙에 따라 크론이 순수 생성만 한다
@ApiTags('자동이체 설정')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('recurring-schedules')
export class RecurringScheduleController {
  constructor(private readonly service: RecurringScheduleService) {}

  // 자동이체 설정 목록 (kind 필터)
  @Get()
  findAll(@CurrentUser() user: AuthUser, @Query() query: QueryRecurringScheduleDto) {
    return this.service.findAll(user.id, query);
  }

  // 자동이체 설정 추가
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateRecurringScheduleDto) {
    return this.service.create(user.id, dto);
  }

  // 자동이체 설정 수정
  @Put(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateRecurringScheduleDto,
  ) {
    return this.service.update(user.id, id, dto);
  }

  // 활성/일시정지 토글
  @Patch(':id/toggle')
  toggle(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.service.toggle(user.id, id);
  }

  // 자동이체 설정 삭제
  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.service.remove(user.id, id);
  }
}
