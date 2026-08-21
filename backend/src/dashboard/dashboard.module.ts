import { Module } from '@nestjs/common';
import { AssetModule } from '../asset/asset.module';
import { PriceLookupService } from '../investment/price-lookup.service';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [AssetModule],
  controllers: [DashboardController],
  providers: [DashboardService, PriceLookupService],
})
export class DashboardModule {}
