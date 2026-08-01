import { Module } from '@nestjs/common';
import { HolidayService } from './holiday.service';

@Module({
  providers: [HolidayService],
  exports: [HolidayService],
})
export class HolidayModule {}
