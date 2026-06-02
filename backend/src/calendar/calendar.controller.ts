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
import { CalendarService } from './calendar.service';
import { CreateEventDto } from './dto/create-event.dto';
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

  // 일정 수정
  @Put(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateEventDto,
  ) {
    return this.service.update(user.id, id, dto);
  }

  // 일정 삭제
  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.service.remove(user.id, id);
  }
}
