import {
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateInvestmentAccountDto {
  @IsString()
  @MaxLength(100)
  name: string;

  // 예수금(원) — 신규 개설 직후 0 가능, 선택값(미입력 시 0)
  @IsOptional()
  @IsNumber()
  cashBalance?: number;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  memo?: string;
}
