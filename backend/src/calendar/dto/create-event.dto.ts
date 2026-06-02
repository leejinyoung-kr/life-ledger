import { CalEventType } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateEventDto {
  // 일정 날짜 (YYYY-MM-DD)
  @IsDateString()
  date: string;

  @IsEnum(CalEventType)
  type: CalEventType;

  @IsString()
  @MaxLength(200)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  memo?: string;
}
