import { PartialType } from '@nestjs/swagger';
import { CreateCredentialDto } from './create-credential.dto';

// 모든 필드 선택적 — 부분 수정(PUT). password/totp 가 오면 재암호화
export class UpdateCredentialDto extends PartialType(CreateCredentialDto) {}
