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
import { CreateSavingDto } from './dto/create-saving.dto';
import { UpdateSavingDto } from './dto/update-saving.dto';
import { SavingService } from './saving.service';

@ApiTags('가계부 - 예적금')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('savings')
export class SavingController {
  constructor(private readonly service: SavingService) {}

  // 요약 (총 잔액/이번 달 납입/평균 금리/만기 임박)
  @Get('summary')
  summary(@CurrentUser() user: AuthUser) {
    return this.service.summary(user.id);
  }

  // 예적금 목록
  @Get()
  findAll(@CurrentUser() user: AuthUser) {
    return this.service.findAll(user.id);
  }

  // 예적금 추가
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateSavingDto) {
    return this.service.create(user.id, dto);
  }

  // 예적금 수정
  @Put(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateSavingDto,
  ) {
    return this.service.update(user.id, id, dto);
  }

  // 예적금 일괄 삭제
  @Delete('bulk')
  removeMany(@CurrentUser() user: AuthUser, @Body('ids') ids: number[]) {
    return this.service.removeMany(user.id, ids);
  }

  // 예적금 삭제
  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.service.remove(user.id, id);
  }
}
