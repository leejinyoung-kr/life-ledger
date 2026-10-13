import { Module } from '@nestjs/common';
import { NotificationModule } from '../notification/notification.module';
import { TransactionModule } from '../transaction/transaction.module';
import { InvestmentModule } from '../investment/investment.module';
import { AssetModule } from '../asset/asset.module';
import { SystemLogModule } from '../system-log/system-log.module';
import { HolidayModule } from '../holiday/holiday.module';
import { NotificationCronService } from './notification-cron.service';
import { TrashCronService } from './trash-cron.service';
import { DbBackupCronService } from './db-backup-cron.service';
import { RecurringCronService } from './recurring-cron.service';
import { NetWorthSnapshotCronService } from './net-worth-snapshot-cron.service';
import { HolidayCronService } from './holiday-cron.service';
import { SubscriptionCronService } from './subscription-cron.service';

// 스케줄 기반 유지보수 — 알림 자동생성 + 휴지통 자동삭제 + DB 백업 + 반복거래/반복매수 + 순자산 스냅샷 + 공휴일 사전 캐싱 + 구독 결제일 갱신.
// 각 작업은 @Job(core-jobs)으로 등록 — 스케줄러(JobsModule)와 실행 기록 저장소는 AppModule 에서 한 번 등록한다
@Module({
  imports: [NotificationModule, TransactionModule, InvestmentModule, AssetModule, SystemLogModule, HolidayModule],
  providers: [
    NotificationCronService, TrashCronService,
    DbBackupCronService, RecurringCronService,
    NetWorthSnapshotCronService, HolidayCronService, SubscriptionCronService,
  ],
})
export class MaintenanceModule {}
