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
import { AssetType } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthUser } from '../auth/strategies/jwt.strategy';
import { AssetService } from './asset.service';
import { CreateAssetDto } from './dto/create-asset.dto';
import { UpdateAssetDto } from './dto/update-asset.dto';

@ApiTags('자산 종합')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('assets')
export class AssetController {
  constructor(private readonly service: AssetService) {}

  // 요약 (총자산/총부채/순자산 + 증감 + 구성 + 유형별)
  @Get('summary')
  summary(@CurrentUser() user: AuthUser) {
    return this.service.summary(user.id);
  }

  // 순자산 추이 (최근 6개월)
  @Get('trend')
  trend(@CurrentUser() user: AuthUser) {
    return this.service.trend(user.id);
  }

  // 자산/부채 목록 (type 쿼리로 필터 — 없으면 realestate+debt 반환)
  @Get()
  findAll(
    @CurrentUser() user: AuthUser,
    @Query('type') type?: AssetType,
    @Query('take') take?: string,
  ) {
    return this.service.findAll(user.id, type, take ? Number(take) : undefined);
  }

  // 자산/부채 추가
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateAssetDto) {
    return this.service.create(user.id, dto);
  }

  // 자산/부채 수정
  @Put(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAssetDto,
  ) {
    return this.service.update(user.id, id, dto);
  }

  // 자산/부채 삭제
  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.service.remove(user.id, id);
  }
}
