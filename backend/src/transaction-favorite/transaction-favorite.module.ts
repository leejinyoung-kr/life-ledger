import { Module } from '@nestjs/common';
import { TransactionFavoriteController } from './transaction-favorite.controller';
import { TransactionFavoriteService } from './transaction-favorite.service';

@Module({
  controllers: [TransactionFavoriteController],
  providers: [TransactionFavoriteService],
})
export class TransactionFavoriteModule {}
