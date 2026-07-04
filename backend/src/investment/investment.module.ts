import { Module } from '@nestjs/common';
import { InvestmentController } from './investment.controller';
import { InvestmentService } from './investment.service';
import { PriceLookupService } from './price-lookup.service';
import { SystemLogModule } from '../system-log/system-log.module';

@Module({
  imports: [SystemLogModule],
  controllers: [InvestmentController],
  providers: [InvestmentService, PriceLookupService],
  exports: [InvestmentService],
})
export class InvestmentModule {}
