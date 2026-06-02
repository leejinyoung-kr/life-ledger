import { PartialType } from '@nestjs/swagger';
import { CreateSavingDto } from './create-saving.dto';

// 모든 필드 선택적 — 부분 수정(PUT) 용
export class UpdateSavingDto extends PartialType(CreateSavingDto) {}
