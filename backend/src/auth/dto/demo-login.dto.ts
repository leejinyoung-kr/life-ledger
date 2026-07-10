import { IsString } from 'class-validator';

// [발표용 임시] 값 검증 없이 형식만 체크 — 발표 끝나면 이 파일 삭제
export class DemoLoginDto {
  @IsString()
  id!: string;

  @IsString()
  password!: string;
}
