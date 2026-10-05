import { TransactionType } from '@prisma/client';
import { IsIn, IsNumber, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateTransactionFavoriteDto {
  // 수입/지출만 — 자산이동은 대상 계좌가 얽혀 있어 즐겨찾기로 두지 않는다
  @IsIn(['income', 'expense'])
  type: Extract<TransactionType, 'income' | 'expense'>;

  @IsString()
  @MaxLength(200)
  title: string;

  // 소분류(leaf) 카테고리 code
  @IsString()
  @MaxLength(50)
  category: string;

  @IsNumber()
  amount: number;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  payMethod?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  memo?: string;
}
