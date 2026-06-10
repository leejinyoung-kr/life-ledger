import { InvestmentType } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { PageQueryDto } from '../../common/dto/page-query.dto';

// 투자 목록 조회 — 유형/종목명 필터 + 페이지네이션
export class QueryInvestmentDto extends PageQueryDto {
  @IsOptional()
  @IsEnum(InvestmentType)
  type?: InvestmentType;

  // 종목명 검색어
  @IsOptional()
  @IsString()
  q?: string;
}
