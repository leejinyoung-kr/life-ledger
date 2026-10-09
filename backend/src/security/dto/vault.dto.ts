import { IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

// 마스터 비번 최소 길이 — 해시가 백업·DB 로 새도 오프라인 대입을 버티도록. 기존 짧은 비번은 해제·잠금해제에 그대로 쓰인다
export const MIN_MASTER_PASSWORD = 8;

// 마스터 잠금 설정/변경
export class SetupVaultDto {
  @IsString()
  @MinLength(MIN_MASTER_PASSWORD)
  @MaxLength(100)
  password!: string;

  // 자동잠금 시간(분). 0 = 수동 잠금만
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1440)
  timeoutMin?: number;
}

// 마스터 비번 확인(해제/잠금해제)
export class VaultPasswordDto {
  @IsString()
  @MaxLength(100)
  password!: string;
}
