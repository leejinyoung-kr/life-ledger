import { Module } from '@nestjs/common';
import { RecurringScheduleController } from './recurring-schedule.controller';
import { RecurringScheduleService } from './recurring-schedule.service';

@Module({
  controllers: [RecurringScheduleController],
  providers: [RecurringScheduleService],
})
export class RecurringScheduleModule {}
