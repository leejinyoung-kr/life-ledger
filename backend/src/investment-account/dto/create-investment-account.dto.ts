import {
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateInvestmentAccountDto {
  @IsString()
  @MaxLength(100)
  name: string;

  // 예수금(원) — 신규 개설 직후 0 가능, 선택값(미입력 시 0)
  @IsOptional()
  @IsNumber()
  cashBalance?: number;

  // 계좌번호(평문 입력 → 저장 시 AES-256-GCM 암호화) — 동일 계좌명 다중 보유 구분용, 신규 생성 시 필수(PartialType 적용된 수정 DTO에서는 선택)
  @IsString()
  @MaxLength(100)
  accountNumber: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  memo?: string;
}
