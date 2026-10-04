import { InvestmentType } from '@prisma/client';
import { IsEnum, IsNumberString, IsOptional, IsString } from 'class-validator';
import { PageQueryDto } from '@leejinyoung-kr/core-common';

// 투자 목록 조회 — 유형/종목명/계좌 필터 + 페이지네이션
export class QueryInvestmentDto extends PageQueryDto {
  @IsOptional()
  @IsEnum(InvestmentType)
  type?: InvestmentType;

  // 종목명 검색어
  @IsOptional()
  @IsString()
  q?: string;

  // 소속 계좌(InvestmentAccount.id) 필터
  @IsOptional()
  @IsNumberString()
  accountId?: string;
}
