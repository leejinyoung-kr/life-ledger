import { Module } from '@nestjs/common';
import { AssetModule } from '../asset/asset.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [AssetModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
