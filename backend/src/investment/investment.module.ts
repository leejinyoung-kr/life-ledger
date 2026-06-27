import { Module } from '@nestjs/common';
import { InvestmentController } from './investment.controller';
import { InvestmentService } from './investment.service';
import { PriceLookupService } from './price-lookup.service';

@Module({
  controllers: [InvestmentController],
  providers: [InvestmentService, PriceLookupService],
  exports: [InvestmentService],
})
export class InvestmentModule {}
