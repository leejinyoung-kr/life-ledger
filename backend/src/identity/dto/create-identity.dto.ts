import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export const IDENTITY_TYPES = ['passport', 'idcard', 'license', 'cert', 'etc'] as const;
export type IdentityTypeDto = (typeof IDENTITY_TYPES)[number];

// 신원 문서 생성 — 종류·명칭·번호 필수, 발급/만료일·메모 선택
export class CreateIdentityDto {
  @IsIn(IDENTITY_TYPES)
  type: IdentityTypeDto;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  number: string;

  @IsOptional()
  @IsString()
  issueDate?: string; // YYYY-MM-DD

  @IsOptional()
  @IsString()
  expireDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  memo?: string;
}
