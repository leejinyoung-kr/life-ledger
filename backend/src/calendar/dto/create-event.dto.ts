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
  // 일정 날짜 (YYYY-MM-DD, 양력 — 날짜 선택기로 고른 실제 날짜). 음력 일정(isLunar=true)이면 서버가 이 날짜의 음력 월/일/윤달여부를 계산해 함께 저장한다.
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

  // 음력 날짜 여부 (없으면 양력) — 켜면 위 date에 대응하는 음력 월/일이 자동 계산되어 매년 반복의 기준이 된다
  @IsOptional()
  @IsBoolean()
  isLunar?: boolean;

  // 반복 주기 (없으면 'none')
  @IsOptional()
  @IsEnum(CalRecurFreq)
  recurFreq?: CalRecurFreq;

  // 반복 종료일 (YYYY-MM-DD, 없으면 무기한)
  @IsOptional()
  @IsDateString()
  recurUntil?: string;

  // 당일 오전 9시 알림(푸시) 여부 (없으면 받지 않음)
  @IsOptional()
  @IsBoolean()
  notify?: boolean;
}
