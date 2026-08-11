import { Module } from '@nestjs/common';
import { SubscriptionController } from './subscription.controller';
import { SubscriptionService } from './subscription.service';
import { PriceLookupService } from '../investment/price-lookup.service';

@Module({
  controllers: [SubscriptionController],
  providers: [SubscriptionService, PriceLookupService],
})
export class SubscriptionModule {}
