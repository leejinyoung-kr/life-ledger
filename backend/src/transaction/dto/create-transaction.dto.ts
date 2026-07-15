import {
  TransactionType,
  TransferTarget,
  TransferDirection,
} from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
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

  // 소분류(leaf) 카테고리 code (예: food_dining). 대분류는 Category.parent_code 로 파생
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

  // 자산이동 누적 대상 종류 — type='transfer'일 때만 의미, targetId와 함께 지정해야 자동 반영됨
  @ValidateIf((o: CreateTransactionDto) => o.targetId !== undefined)
  @IsEnum(TransferTarget)
  targetType?: TransferTarget;

  // 자산이동 누적 대상 id (Saving/Investment/Asset.id, target_type 기준)
  @ValidateIf((o: CreateTransactionDto) => o.targetType !== undefined)
  @IsInt()
  targetId?: number;

  // 대상 잔액 변화 방향 — asset 대상 전용(예: 할부 구매=increase, 상환=decrease). 미지정 시 자산 유형 기반 기존 동작
  @IsOptional()
  @IsEnum(TransferDirection)
  targetDirection?: TransferDirection;
}
