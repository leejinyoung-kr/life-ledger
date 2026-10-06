import { PartialType } from '@nestjs/swagger';
import { CreateTransactionFavoriteDto } from './create-transaction-favorite.dto';

// 모든 필드를 선택적으로 — 부분 수정(PUT) 용
export class UpdateTransactionFavoriteDto extends PartialType(CreateTransactionFavoriteDto) {}
