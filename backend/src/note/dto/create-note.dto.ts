import { IsOptional, IsString, MaxLength } from 'class-validator';

// 모든 필드 선택 — 빈 메모로 생성 후 편집 흐름 지원 (서비스에서 기본값 적용)
export class CreateNoteDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  body?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  tag?: string;
}
