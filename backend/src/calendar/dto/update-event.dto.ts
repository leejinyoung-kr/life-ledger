import { PartialType } from '@nestjs/swagger';
import { CreateEventDto } from './create-event.dto';

// 모든 필드를 선택적으로 — 부분 수정(PUT) 용
export class UpdateEventDto extends PartialType(CreateEventDto) {}
