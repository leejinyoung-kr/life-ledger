import { TransactionType } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';
import { PageQueryDto } from '@leejinyoun/core-common';

export class QueryTransactionDto extends PageQueryDto {
  // 조회 시작일 (YYYY-MM-DD)
  @IsOptional()
  @IsDateString()
  from?: string;

  // 조회 종료일 (YYYY-MM-DD)
  @IsOptional()
  @IsDateString()
  to?: string;

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
