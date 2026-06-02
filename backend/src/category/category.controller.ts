import {
  Body, Controller, Delete, Get, Param, ParseIntPipe,
  Patch, Post, Query, UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CategoryDomain } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthUser } from '../auth/strategies/jwt.strategy';
import { CategoryService } from './category.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@ApiTags('카테고리 관리')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('categories')
export class CategoryController {
  constructor(private readonly service: CategoryService) {}

  // 카테고리 목록 (도메인 필터 선택)
  @Get()
  findAll(
    @CurrentUser() user: AuthUser,
    @Query('domain') domain?: CategoryDomain,
  ) {
    return this.service.findAll(user.id, domain);
  }

  // 카테고리 추가
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateCategoryDto) {
    return this.service.create(user.id, dto);
  }

  // 기본 카테고리 시드 (도메인 미지정 시 전체)
  @Post('seed')
  seed(
    @CurrentUser() user: AuthUser,
    @Query('domain') domain?: CategoryDomain,
  ) {
    return this.service.seed(user.id, domain);
  }

  // 카테고리 수정
  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.service.update(user.id, id, dto);
  }

  // 카테고리 삭제
  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.service.remove(user.id, id);
  }
}
