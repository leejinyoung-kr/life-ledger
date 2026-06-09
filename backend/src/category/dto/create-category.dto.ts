import { CategoryDomain } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreateCategoryDto {
  @IsEnum(CategoryDomain)
  domain: CategoryDomain;

  @IsString()
  @MaxLength(50)
  code: string;

  @IsString()
  @MaxLength(100)
  label: string;

  // 소분류면 대분류 code, 대분류면 미지정
  @IsOptional()
  @IsString()
  @MaxLength(50)
  parentCode?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
