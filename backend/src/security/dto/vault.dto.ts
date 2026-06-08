import { IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

// 마스터 잠금 설정/변경
export class SetupVaultDto {
  @IsString()
  @MinLength(4)
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
