import { Module } from '@nestjs/common';
import { InvestmentAccountController } from './investment-account.controller';
import { InvestmentAccountService } from './investment-account.service';

@Module({
  controllers: [InvestmentAccountController],
  providers: [InvestmentAccountService],
})
export class InvestmentAccountModule {}
