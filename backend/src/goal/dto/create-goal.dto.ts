import { GoalTone } from '@prisma/client';
import { IsEnum, IsIn, IsInt, IsNumber, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateGoalDto {
  @IsString()
  @MaxLength(200)
  name: string;

  // 단위 — won(원) | percent(%)
  @IsIn(['won', 'percent'])
  unit: string;

  @IsNumber()
  currentVal: number;

  @IsNumber()
  targetVal: number;

  // 진행률(%)
  @IsInt()
  pct: number;

  @IsOptional()
  @IsEnum(GoalTone)
  tone?: GoalTone;
}
