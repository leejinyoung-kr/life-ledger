import { RecurringKind } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';

export class QueryRecurringScheduleDto {
  @IsOptional()
  @IsEnum(RecurringKind)
  kind?: RecurringKind;
}
