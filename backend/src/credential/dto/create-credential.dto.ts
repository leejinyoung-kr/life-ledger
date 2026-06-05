import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

// 계정 생성 — 서비스명·카테고리·아이디·비밀번호 필수, URL·TOTP·메모 선택
export class CreateCredentialDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  url?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(50)
  category: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  username: string;

  @IsString()
  @MinLength(1)
  password: string;

  @IsOptional()
  @IsString()
  totp?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  memo?: string;
}
