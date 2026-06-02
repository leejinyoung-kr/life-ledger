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

  @IsString()
  @MaxLength(50)
  payMethod: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  memo?: string;

  @IsOptional()
  @IsBoolean()
  isRecurring?: boolean;
}
