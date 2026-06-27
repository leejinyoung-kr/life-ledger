import { CalEventType, CalRecurFreq } from '@prisma/client';
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

  // 반복 주기 (없으면 'none')
  @IsOptional()
  @IsEnum(CalRecurFreq)
  recurFreq?: CalRecurFreq;

  // 반복 종료일 (YYYY-MM-DD, 없으면 무기한)
  @IsOptional()
  @IsDateString()
  recurUntil?: string;
}
