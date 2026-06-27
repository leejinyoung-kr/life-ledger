import { IsEnum, IsNumber, IsOptional, Min } from 'class-validator';

export enum ExchangeDirection {
  KRW_TO_USD = 'krw_to_usd',
  USD_TO_KRW = 'usd_to_krw',
}

// 계좌 내 원화↔달러 환전 — direction 기준 차감 통화에서 amount만큼 빼서 환율로 환산해 다른 통화에 더함
export class ExchangeInvestmentAccountDto {
  @IsEnum(ExchangeDirection)
  direction: ExchangeDirection;

  // 차감되는 통화 기준 금액 (KRW_TO_USD면 원화, USD_TO_KRW면 달러)
  @IsNumber()
  @Min(0.01)
  amount: number;

  // 환율(1달러당 원화) — 미입력 시 실시간 조회
  @IsOptional()
  @IsNumber()
  @Min(0.01)
  rate?: number;
}
