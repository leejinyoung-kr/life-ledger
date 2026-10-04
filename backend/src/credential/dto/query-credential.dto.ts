import { IsOptional, IsString } from 'class-validator';
import { PageQueryDto } from '@leejinyoung-kr/core-common';

// 계정 목록 조회 — 검색어(서비스명/URL/아이디)/카테고리 필터 + 페이지네이션
export class QueryCredentialDto extends PageQueryDto {
  // 서비스명·URL·아이디 통합 검색어
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsString()
  category?: string;
}
