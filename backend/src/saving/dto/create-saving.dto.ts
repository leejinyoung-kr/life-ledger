import { SavingType } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateSavingDto {
  @IsString()
  @MaxLength(100)
  bank: string;

  @IsString()
  @MaxLength(100)
  name: string;

  @IsEnum(SavingType)
  type: SavingType;

  // 금리(%)
  @IsNumber()
  interestRate: number;

  // 월 납입액(원)
  @IsNumber()
  monthlyAmount: number;

  @IsDateString()
  startDate: string;

  @IsOptional()
  @IsDateString()
  maturityDate?: string;

  // 현재 잔액(원)
  @IsNumber()
  balance: number;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  memo?: string;
}
