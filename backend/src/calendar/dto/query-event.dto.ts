import { IsOptional, Matches } from 'class-validator';

export class QueryEventDto {
  // 조회 월 (YYYY-MM). 미지정 시 전체
  @IsOptional()
  @Matches(/^\d{4}-\d{2}$/, { message: 'month 은 YYYY-MM 형식이어야 합니다.' })
  month?: string;
}
