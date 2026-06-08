import {
  IsArray,
  IsBoolean,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

// 부분 수정 — 각 설정 섹션의 저장 버튼이 자신이 바꾼 필드만 보낸다.
// budgets/categories/widgets 는 JSON 컬럼이라 형태만 검증(deep validation 생략).
export class UpdateSettingsDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  displayName?: string;

  @IsOptional()
  @IsBoolean()
  notifBudget?: boolean;

  @IsOptional()
  @IsBoolean()
  notifMonthly?: boolean;

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
  @IsIn(['7d', '1d', '12h', 'none'])
  sessionExpiry?: string;

  @IsOptional()
  @IsIn(['10s', '30s', '1m', 'none'])
  pwAutoHide?: string;

  // 빈 문자열/미전송이면 기존 키 유지 (서비스에서 처리)
  @IsOptional()
  @IsString()
  @MaxLength(200)
  openaiApiKey?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  openaiModel?: string;

  // { 카테고리코드: 금액 }
  @IsOptional()
  @IsObject()
  budgets?: Record<string, number>;

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
