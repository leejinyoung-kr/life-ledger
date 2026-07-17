import { IsOptional, IsString } from 'class-validator';
import { PageQueryDto } from '@leejinyoun/core-common';

// 구독 목록 조회 — 서비스명/카테고리 검색 + 페이지네이션
export class QuerySubscriptionDto extends PageQueryDto {
  // 서비스명·카테고리 검색어
  @IsOptional()
  @IsString()
  q?: string;
}
