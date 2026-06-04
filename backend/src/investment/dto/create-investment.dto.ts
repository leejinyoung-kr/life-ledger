import { InvestmentType } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateInvestmentDto {
  @IsString()
  @MaxLength(100)
  name: string;

  @IsEnum(InvestmentType)
  type: InvestmentType;

  // 투자원금(원)
  @IsNumber()
  principal: number;

  // 현재 평가금액(원)
  @IsNumber()
  currentValue: number;

  // 최초 매수일 — 과거 매수일을 모를 수 있어 선택값
  @IsOptional()
  @IsDateString()
  purchaseDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  memo?: string;
}
