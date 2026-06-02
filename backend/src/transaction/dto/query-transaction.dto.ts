import { TransactionType } from '@prisma/client';
import { IsEnum, IsOptional, IsString, Matches } from 'class-validator';

export class QueryTransactionDto {
  // 조회 월 (YYYY-MM). 미지정 시 전체
  @IsOptional()
  @Matches(/^\d{4}-\d{2}$/, { message: 'month 은 YYYY-MM 형식이어야 합니다.' })
  month?: string;

  @IsOptional()
  @IsEnum(TransactionType)
  type?: TransactionType;

  @IsOptional()
  @IsString()
  category?: string;

  // 내역명 검색어
  @IsOptional()
  @IsString()
  q?: string;
}
