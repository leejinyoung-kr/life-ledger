import { TransactionType } from '@prisma/client';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateTransactionDto {
  @IsEnum(TransactionType)
  type: TransactionType;

  // 거래일 (YYYY-MM-DD)
  @IsDateString()
  date: string;

  @IsString()
  @MaxLength(200)
  title: string;

  // 카테고리 코드 (food/transport/subscription/shopping/salary/transfer/etc)
  @IsString()
  @MaxLength(50)
  category: string;

  @IsNumber()
  amount: number;

  // 결제수단 — 지출에만 의미. 수입/자산이동이면 미입력(빈값 저장)
  @IsOptional()
  @IsString()
  @MaxLength(50)
  payMethod?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  memo?: string;

  @IsOptional()
  @IsBoolean()
  isRecurring?: boolean;

  // 반복 규칙 — cycle(주기)/day(기준일)/weekendAdjust(주말 처리)
  @IsOptional()
  recurringRule?: Record<string, unknown>;
}
