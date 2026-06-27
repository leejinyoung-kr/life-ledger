import { SubscriptionCycle, SubscriptionStatus } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateSubscriptionDto {
  @IsString()
  @MaxLength(100)
  name: string;

  // 카테고리 코드 (ott/music/cloud/shopping/ai/etc)
  @IsString()
  @MaxLength(50)
  category: string;

  // 결제금액(원). 주기당 청구 금액(연 구독이면 연 금액)
  @IsNumber()
  amount: number;

  @IsEnum(SubscriptionCycle)
  cycle: SubscriptionCycle;

  @IsOptional()
  @IsEnum(SubscriptionStatus)
  status?: SubscriptionStatus;

  // 다음 결제일 (YYYY-MM-DD)
  @IsDateString()
  nextPaymentDate: string;

  @IsString()
  @MaxLength(50)
  payMethod: string;

  // 마지막 사용일 (YYYY-MM-DD)
  @IsOptional()
  @IsDateString()
  lastUsedAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  memo?: string;
}
