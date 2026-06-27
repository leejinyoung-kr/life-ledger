import { Module } from '@nestjs/common';
import { PriceLookupService } from '../investment/price-lookup.service';
import { AssetController } from './asset.controller';
import { AssetService } from './asset.service';

@Module({
  controllers: [AssetController],
  providers: [AssetService, PriceLookupService],
  exports: [AssetService],
})
export class AssetModule {}
