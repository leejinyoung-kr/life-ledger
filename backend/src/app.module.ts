import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AssetModule } from './asset/asset.module';
import { AuthModule } from './auth/auth.module';
import { InvestmentModule } from './investment/investment.module';
import { PrismaModule } from './prisma/prisma.module';
import { SavingModule } from './saving/saving.module';
import { SettingsModule } from './settings/settings.module';
import { SubscriptionModule } from './subscription/subscription.module';
import { TransactionModule } from './transaction/transaction.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    TransactionModule,
    SavingModule,
    InvestmentModule,
    SubscriptionModule,
    AssetModule,
    SettingsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
