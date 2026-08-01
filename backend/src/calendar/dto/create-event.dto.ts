import { CalEventType, CalRecurFreq } from '@prisma/client';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateEventDto {
  // 일정 날짜 (YYYY-MM-DD). 음력 일정(isLunar=true)이면 이 날짜의 월/일을 음력 월/일로 해석해 서버가 양력으로 환산한다.
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

  // 음력 날짜 여부 (없으면 양력)
  @IsOptional()
  @IsBoolean()
  isLunar?: boolean;

  // 윤달 여부 (isLunar=true일 때만 의미 있음)
  @IsOptional()
  @IsBoolean()
  lunarLeap?: boolean;

  // 반복 주기 (없으면 'none')
  @IsOptional()
  @IsEnum(CalRecurFreq)
  recurFreq?: CalRecurFreq;

  // 반복 종료일 (YYYY-MM-DD, 없으면 무기한)
  @IsOptional()
  @IsDateString()
  recurUntil?: string;
}
