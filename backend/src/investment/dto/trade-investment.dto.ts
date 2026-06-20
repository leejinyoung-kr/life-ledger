import { IsNumber, Min } from 'class-validator';

// 예수금↔평가금액 전환 금액 (매수/매도 공용)
export class TradeInvestmentDto {
  @IsNumber()
  @Min(0.01)
  amount: number;
}
