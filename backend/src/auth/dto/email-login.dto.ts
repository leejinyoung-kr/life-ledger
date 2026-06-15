import { IsEmail, IsString, Length } from 'class-validator';

// 이메일 코드 발송 요청
export class RequestEmailCodeDto {
  @IsEmail({}, { message: '올바른 이메일 형식이 아닙니다.' })
  email!: string;
}

// 이메일 코드 검증
export class VerifyEmailCodeDto {
  @IsEmail({}, { message: '올바른 이메일 형식이 아닙니다.' })
  email!: string;

  @IsString()
  @Length(6, 6, { message: '인증코드는 6자리입니다.' })
  code!: string;
}
