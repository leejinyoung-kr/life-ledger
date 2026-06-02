import { PartialType } from '@nestjs/swagger';
import { CreateInvestmentDto } from './create-investment.dto';

// 모든 필드 선택적 — 부분 수정(PUT) 용
export class UpdateInvestmentDto extends PartialType(CreateInvestmentDto) {}
