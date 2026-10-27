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
import { CalendarService } from './calendar.service';
import { BulkCreateEventDto } from './dto/bulk-create-event.dto';
import { CreateEventDto } from './dto/create-event.dto';
import { DeleteEventDto } from './dto/delete-event.dto';
import { QueryEventDto } from './dto/query-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';

@ApiTags('캘린더')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('calendar')
export class CalendarController {
  constructor(private readonly service: CalendarService) {}

  // 다가오는 일정
  @Get('upcoming')
  upcoming(@CurrentUser() user: AuthUser) {
    return this.service.upcoming(user.id);
  }

  // 일정 목록 (월 필터)
  @Get()
  findAll(@CurrentUser() user: AuthUser, @Query() query: QueryEventDto) {
    return this.service.findAll(user.id, query.month);
  }

  // 일정 추가
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateEventDto) {
    return this.service.create(user.id, dto);
  }

  // 일정 일괄 추가 (최대 50건, 전부 저장되거나 하나도 저장되지 않음)
  @Post('bulk')
  bulkCreate(@CurrentUser() user: AuthUser, @Body() dto: BulkCreateEventDto) {
    return this.service.bulkCreate(user.id, dto.events);
  }

  // 일정 수정
  @Put(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateEventDto,
  ) {
    return this.service.update(user.id, id, dto);
  }

  // 일정 삭제 (반복 일정은 query.occurrenceDate 이후 발생만 중단, 이전 발생은 유지)
  @Delete(':id')
  remove(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Query() query: DeleteEventDto,
  ) {
    return this.service.remove(user.id, id, query.occurrenceDate);
  }
}
