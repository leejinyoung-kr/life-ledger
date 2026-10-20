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
  // 코드 관리 bank code (ADR 0009)
  @IsString()
  @MaxLength(100)
  bank: string;

  @IsString()
  @MaxLength(100)
  name: string;

  @IsEnum(SavingType)
  type: SavingType;

  // 금리(%) — 청약/기타는 금리 개념이 없을 수 있어 선택값(미입력 시 0)
  @IsOptional()
  @IsNumber()
  interestRate?: number;

  // 월 납입액(원) — 예금 등 월납입 없는 상품 고려 선택값(미입력 시 0)
  @IsOptional()
  @IsNumber()
  monthlyAmount?: number;

  @IsDateString()
  startDate: string;

  @IsOptional()
  @IsDateString()
  maturityDate?: string;

  // 현재 잔액(원) — 신규 가입 직후 0 가능, 선택값(미입력 시 0)
  @IsOptional()
  @IsNumber()
  balance?: number;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  memo?: string;
}
