import { IsOptional, IsString } from 'class-validator';
import { PageQueryDto } from '@leejinyoun/core-common';

// 투자 계좌 목록 조회 — 계좌명 검색어 + 페이지네이션
export class QueryInvestmentAccountDto extends PageQueryDto {
  @IsOptional()
  @IsString()
  q?: string;
}
