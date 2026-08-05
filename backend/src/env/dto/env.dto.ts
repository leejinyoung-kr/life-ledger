import { PartialType } from '@nestjs/swagger';
import {
  ArrayNotEmpty,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export const ENV_KINDS = ['dev', 'staging', 'prod'] as const;
export type EnvKindDto = (typeof ENV_KINDS)[number];

// ENV 프로젝트 생성 — 이름 필수, 설명 선택
export class CreateEnvProjectDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  description?: string;
}

export class UpdateEnvProjectDto extends PartialType(CreateEnvProjectDto) {}

// ENV 변수 생성 — 적용 환경 1개 이상, KEY/VALUE 필수
export class CreateEnvVarDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsIn(ENV_KINDS, { each: true })
  envs: EnvKindDto[];

  @IsOptional()
  @IsString()
  @MaxLength(50)
  group?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  location?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(150)
  key: string;

  @IsString()
  value: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  memo?: string;
}

// ENV 변수 수정 — 환경(env)은 고정, 나머지만 부분 수정
export class UpdateEnvVarDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  group?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  location?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  key?: string;

  @IsOptional()
  @IsString()
  value?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  memo?: string;
}

// .env 텍스트 일괄 저장 — 대상 환경 + 원문 텍스트
export class BulkEnvDto {
  @IsIn(ENV_KINDS)
  env: EnvKindDto;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  location?: string;

  @IsString()
  text: string;
}
