import { Module } from '@nestjs/common';
import { HolidayModule } from '../holiday/holiday.module';
import { CalendarController } from './calendar.controller';
import { CalendarService } from './calendar.service';

@Module({
  imports: [HolidayModule],
  controllers: [CalendarController],
  providers: [CalendarService],
})
export class CalendarModule {}
