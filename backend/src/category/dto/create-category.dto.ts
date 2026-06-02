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

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
