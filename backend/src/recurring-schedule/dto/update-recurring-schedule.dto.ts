import { PartialType } from '@nestjs/swagger';
import { CreateRecurringScheduleDto } from './create-recurring-schedule.dto';

// 모든 필드를 선택적으로 — 부분 수정(PUT) 용
export class UpdateRecurringScheduleDto extends PartialType(CreateRecurringScheduleDto) {}
