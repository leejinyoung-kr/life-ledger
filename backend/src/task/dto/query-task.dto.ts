import { IsOptional, IsString } from 'class-validator';
import { PageQueryDto } from '@leejinyoun/core-common';

// 할일 목록 조회 — 내용 검색 + 페이지네이션
export class QueryTaskDto extends PageQueryDto {
  // 할일 내용 검색어
  @IsOptional()
  @IsString()
  q?: string;
}
