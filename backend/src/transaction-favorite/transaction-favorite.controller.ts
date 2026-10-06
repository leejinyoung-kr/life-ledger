import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@leejinyoung-kr/core-auth';
import { JwtAuthGuard } from '@leejinyoung-kr/core-auth';
import type { AuthUser } from '../auth/auth-user';
import { CreateTransactionFavoriteDto } from './dto/create-transaction-favorite.dto';
import { ReorderTransactionFavoriteDto } from './dto/reorder-transaction-favorite.dto';
import { UpdateTransactionFavoriteDto } from './dto/update-transaction-favorite.dto';
import { TransactionFavoriteService } from './transaction-favorite.service';

// 거래 즐겨찾기 — 자주 쓰는 수입/지출 내역을 저장해 두고 오늘 날짜로 바로 불러온다
@ApiTags('거래 즐겨찾기')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('transaction-favorites')
export class TransactionFavoriteController {
  constructor(private readonly service: TransactionFavoriteService) {}

  // 즐겨찾기 목록
  @Get()
  findAll(@CurrentUser() user: AuthUser) {
    return this.service.findAll(user.id);
  }

  // 즐겨찾기 추가
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateTransactionFavoriteDto) {
    return this.service.create(user.id, dto);
  }

  // 표시 순서 변경
  @Put('order')
  reorder(@CurrentUser() user: AuthUser, @Body() dto: ReorderTransactionFavoriteDto) {
    return this.service.reorder(user.id, dto.ids);
  }

  // 즐겨찾기 수정
  @Put(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTransactionFavoriteDto,
  ) {
    return this.service.update(user.id, id, dto);
  }

  // 즐겨찾기 삭제
  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.service.remove(user.id, id);
  }
}
