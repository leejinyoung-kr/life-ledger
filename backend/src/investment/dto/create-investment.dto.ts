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

  @IsDateString()
  purchaseDate: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  memo?: string;
}
