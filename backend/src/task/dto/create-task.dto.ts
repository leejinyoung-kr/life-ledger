import { TaskPriority } from '@prisma/client';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateTaskDto {
  @IsString()
  @MaxLength(300)
  text: string;

  // 마감일 (YYYY-MM-DD)
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  memo?: string;

  @IsOptional()
  @IsBoolean()
  done?: boolean;
}
