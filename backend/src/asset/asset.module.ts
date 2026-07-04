import { Module } from '@nestjs/common';
import { PriceLookupService } from '../investment/price-lookup.service';
import { AssetController } from './asset.controller';
import { AssetService } from './asset.service';
import { SystemLogModule } from '../system-log/system-log.module';

@Module({
  imports: [SystemLogModule],
  controllers: [AssetController],
  providers: [AssetService, PriceLookupService],
  exports: [AssetService],
})
export class AssetModule {}
