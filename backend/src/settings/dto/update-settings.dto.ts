import {
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

// 부분 수정 — 각 설정 섹션의 저장 버튼이 자신이 바꾼 필드만 보낸다.
// categories/widgets 는 JSON 컬럼이라 형태만 검증(deep validation 생략).
export class UpdateSettingsDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  displayName?: string;

  @IsOptional()
  @IsBoolean()
  notifUpload?: boolean;

  @IsOptional()
  @IsBoolean()
  notifMaturity?: boolean;

  @IsOptional()
  @IsBoolean()
  notifDeadline?: boolean;

  @IsOptional()
  @IsBoolean()
  showHolidays?: boolean;

  @IsOptional()
  @IsIn(['7d', '1d', '12h', 'none'])
  sessionExpiry?: string;

  @IsOptional()
  @IsIn(['10s', '30s', '1m', 'none'])
  pwAutoHide?: string;

  // [{ emoji, name }]
  @IsOptional()
  @IsArray()
  categories?: { emoji: string; name: string }[];

  // [{ id, on }] — 배열 순서가 표시 순서
  @IsOptional()
  @IsArray()
  widgets?: { id: string; on: boolean }[];

  // 사이드바 1차 메뉴 순서 (key 배열)
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  menuOrder?: string[];
}
