import { IsIn, IsOptional } from 'class-validator';
import { PageQueryDto } from '@leejinyoun/core-common';

// 알림 목록 조회 — 그룹(가계부/시스템) 필터 + 페이지네이션
export class QueryNotificationDto extends PageQueryDto {
  @IsOptional()
  @IsIn(['ledger', 'system'])
  group?: string;
}
