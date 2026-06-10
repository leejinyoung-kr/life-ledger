import { IsOptional, IsString } from 'class-validator';
import { PageQueryDto } from '../../common/dto/page-query.dto';

// 휴지통 목록 조회 — 유형(라벨)/이름 검색 + 페이지네이션.
// 휴지통은 9개 테이블을 메모리에서 합쳐 정렬하므로 필터/슬라이스도 서비스에서 수행한다.
export class QueryTrashDto extends PageQueryDto {
  // 유형 라벨(가계부/예적금/...) 필터
  @IsOptional()
  @IsString()
  type?: string;

  // 항목명 검색어
  @IsOptional()
  @IsString()
  q?: string;
}
