import { Module } from '@nestjs/common';
import { PriceLookupService } from '../investment/price-lookup.service';
import { InvestmentAccountController } from './investment-account.controller';
import { InvestmentAccountService } from './investment-account.service';

@Module({
  controllers: [InvestmentAccountController],
  providers: [InvestmentAccountService, PriceLookupService],
})
export class InvestmentAccountModule {}
