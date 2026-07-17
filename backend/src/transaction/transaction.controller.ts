import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { CurrentUser } from '@leejinyoun/core-auth';
import { JwtAuthGuard } from '@leejinyoun/core-auth';
import type { AuthUser } from '../auth/auth-user';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { QueryTransactionDto } from './dto/query-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { TransactionService } from './transaction.service';

@ApiTags('가계부 - 수입/지출')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('transactions')
export class TransactionController {
  constructor(private readonly service: TransactionService) {}

  // 월 요약 (수입/지출/저축이동/잔액)
  @Get('summary')
  summary(@CurrentUser() user: AuthUser, @Query('month') month?: string) {
    return this.service.summary(user.id, month);
  }

  // 월별 지출 추이 (최근 5개월)
  @Get('monthly-trend')
  monthlyTrend(@CurrentUser() user: AuthUser, @Query('month') month?: string) {
    return this.service.monthlyTrend(user.id, month);
  }

  // 내역 목록 (필터)
  @Get()
  findAll(@CurrentUser() user: AuthUser, @Query() query: QueryTransactionDto) {
    return this.service.findAll(user.id, query);
  }

  // 현재 필터에 해당하는 내역을 .xlsx 로 스트리밍 내보내기 (다운로드)
  @Get('export')
  async export(
    @CurrentUser() user: AuthUser,
    @Query() query: QueryTransactionDto,
    @Res() res: Response,
  ): Promise<void> {
    const filename = encodeURIComponent('가계부.xlsx');
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="transactions.xlsx"; filename*=UTF-8''${filename}`,
    });
    // WorkbookWriter 가 res 스트림에 직접 쓰고 commit 시 응답을 종료한다
    await this.service.streamExport(user.id, query, res);
  }

  // 내역 추가
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateTransactionDto) {
    return this.service.create(user.id, dto);
  }

  // 엑셀 양식 업로드 → 일괄 추가 (multipart 필드명: file)
  @Post('import')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    }),
  )
  importExcel(
    @CurrentUser() user: AuthUser,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('업로드할 파일이 없습니다.');
    return this.service.importExcel(user.id, file.buffer);
  }

  // 내역 수정
  @Put(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTransactionDto,
  ) {
    return this.service.update(user.id, id, dto);
  }

  // 내역 일괄 삭제
  @Delete('bulk')
  removeMany(@CurrentUser() user: AuthUser, @Body('ids') ids: number[]) {
    return this.service.removeMany(user.id, ids);
  }

  // 내역 삭제
  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.service.remove(user.id, id);
  }
}
