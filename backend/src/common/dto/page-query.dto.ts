import { IsNumberString, IsOptional } from 'class-validator';

// 페이지네이션 공통 쿼리. 전역 ValidationPipe 가 transform 비활성이라 문자열로 받아 서비스에서 파싱한다.
// page 가 있으면 서버 페이징 응답(Paginated<T>) 활성, 없으면 전체 배열 반환(기존 호환).
export class PageQueryDto {
  @IsOptional()
  @IsNumberString()
  page?: string;

  @IsOptional()
  @IsNumberString()
  limit?: string;
}
