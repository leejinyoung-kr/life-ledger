import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsInt, IsString, Matches, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class BudgetItemDto {
  @ApiProperty({ example: 'food' })
  @IsString()
  category!: string;

  @ApiProperty({ example: 350000 })
  @IsInt()
  @Min(0)
  amount!: number;
}

export class UpsertBudgetsDto {
  @ApiProperty({ example: '2026-06' })
  @IsString()
  @Matches(/^\d{4}-\d{2}$/, { message: '월 형식은 YYYY-MM 이어야 합니다.' })
  month!: string;

  @ApiProperty({ type: [BudgetItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BudgetItemDto)
  items!: BudgetItemDto[];
}
