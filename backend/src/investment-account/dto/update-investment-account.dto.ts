import { PartialType } from '@nestjs/swagger';
import { CreateInvestmentAccountDto } from './create-investment-account.dto';

// 모든 필드 선택적 — 부분 수정(PUT) 용
export class UpdateInvestmentAccountDto extends PartialType(CreateInvestmentAccountDto) {}
