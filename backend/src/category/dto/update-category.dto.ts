import { IsBoolean, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class UpdateCategoryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  label?: string;

  // 소분류 대분류 변경(빈 문자열이면 대분류로 전환 → NULL)
  @IsOptional()
  @IsString()
  @MaxLength(50)
  parentCode?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
