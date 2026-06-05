import { IsIn, IsNumber, IsOptional, IsString, MaxLength } from 'class-validator';

// 자산 관리 페이지에서 직접 입력하는 유형만 허용 (예적금·투자는 전용 테이블에서 관리)
const MANAGED_TYPES = ['realestate', 'debt'] as const;
type ManagedAssetType = (typeof MANAGED_TYPES)[number];

export class CreateAssetDto {
  @IsIn(MANAGED_TYPES)
  type: ManagedAssetType;

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
