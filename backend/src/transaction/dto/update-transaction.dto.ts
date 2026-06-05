import { PartialType } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { CreateTransactionDto } from './create-transaction.dto';

// 모든 필드를 선택적으로 — 부분 수정(PUT) 용
export class UpdateTransactionDto extends PartialType(CreateTransactionDto) {
  // 반복 거래 수정 범위 — one(이 회차만, 기본) / future(이후 전체) / all(전체)
  @IsOptional()
  @IsIn(['one', 'future', 'all'])
  scope?: 'one' | 'future' | 'all';
}
