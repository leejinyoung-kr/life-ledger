import { InvestmentType } from '@prisma/client';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateInvestmentDto {
  // 소속 투자 계좌 (InvestmentAccount.id) — 예수금을 공유할 계좌
  @IsInt()
  accountId: number;

  @IsString()
  @MaxLength(100)
  name: string;

  @IsEnum(InvestmentType)
  type: InvestmentType;

  // 시세조회용 종목코드(국내, 예: 005930) 또는 티커(해외, 예: AAPL) — 선택
  @IsOptional()
  @IsString()
  @MaxLength(20)
  symbol?: string;

  // 보유수량 — 시세조회 시 단가와 곱해 평가금액을 계산(소수 허용: 해외주식 소수단위 매수 대응)
  @IsOptional()
  @IsNumber()
  quantity?: number;

  // 투자원금(원)
  @IsNumber()
  principal: number;

  // 현재 평가금액(원)
  @IsNumber()
  currentValue: number;

  // 최초 매수일 — 과거 매수일을 모를 수 있어 선택값
  @IsOptional()
  @IsDateString()
  purchaseDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  memo?: string;

  // 반복매수(주식모으기) 사용 여부 — true면 recurringBuyRule/recurringBuyAmount 필수
  @IsOptional()
  @IsBoolean()
  recurringBuyEnabled?: boolean;

  // 반복 규칙 — cycle(주기)/day(기준일)/weekendAdjust(주말 처리). transaction.recurringRule과 동일 구조
  @IsOptional()
  recurringBuyRule?: Record<string, unknown>;

  // 회차당 매수금액(국내: 원, 해외: 달러) — recurringBuyQuantity와 동시 사용 불가
  @IsOptional()
  @IsNumber()
  recurringBuyAmount?: number;

  // 회차당 매수수량(주) — recurringBuyAmount와 동시 사용 불가, 둘 중 하나만 입력
  @IsOptional()
  @IsNumber()
  recurringBuyQuantity?: number;
}
