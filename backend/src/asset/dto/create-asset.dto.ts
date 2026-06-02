import { AssetType } from '@prisma/client';
import { IsEnum, IsNumber, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateAssetDto {
  @IsEnum(AssetType)
  type: AssetType;

  @IsString()
  @MaxLength(100)
  name: string;

  // 금액(원). debt 유형이면 부채 잔액
  @IsNumber()
  amount: number;

  // 금리(%) — 예적금/부채 등 (선택)
  @IsOptional()
  @IsNumber()
  interestRate?: number;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  memo?: string;
}
