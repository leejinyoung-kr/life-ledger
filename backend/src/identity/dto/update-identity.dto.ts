import { PartialType } from '@nestjs/swagger';
import { CreateIdentityDto } from './create-identity.dto';

// 모든 필드 선택적 — 부분 수정(PUT). number 가 오면 재암호화
export class UpdateIdentityDto extends PartialType(CreateIdentityDto) {}
