import { IsNumber, IsOptional, Min } from 'class-validator';

// 매수/매도 공용 — 수량 기준. 단가는 종목코드가 있으면 시세조회로 자동, 없으면(가상자산 등) 직접 입력 필수
export class TradeInvestmentDto {
  @IsNumber()
  @Min(0.000001)
  quantity: number;

  // 단가(원) — 미입력 시 종목코드로 실시간 시세조회해서 사용
  @IsOptional()
  @IsNumber()
  @Min(0.01)
  price?: number;
}
