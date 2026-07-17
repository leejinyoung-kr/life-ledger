import { SavingType } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { PageQueryDto } from '@leejinyoun/core-common';

// 예적금 목록 조회 — 유형/상품명 필터 + 페이지네이션
export class QuerySavingDto extends PageQueryDto {
  @IsOptional()
  @IsEnum(SavingType)
  type?: SavingType;

  // 상품명 검색어
  @IsOptional()
  @IsString()
  q?: string;
}
