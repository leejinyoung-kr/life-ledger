import { Module } from '@nestjs/common';
import { PushModule } from '../push/push.module';
import { AiModule } from '../ai/ai.module';
import { TransactionModule } from '../transaction/transaction.module';
import { InvestmentModule } from '../investment/investment.module';
import { AssetModule } from '../asset/asset.module';
import { SystemLogModule } from '../system-log/system-log.module';
import { HolidayModule } from '../holiday/holiday.module';
import { NotificationCronService } from './notification-cron.service';
import { TrashCronService } from './trash-cron.service';
import { SecuritySnapshotCronService } from './security-snapshot-cron.service';
import { DbBackupCronService } from './db-backup-cron.service';
import { AiReportCronService } from './ai-report-cron.service';
import { RecurringCronService } from './recurring-cron.service';
import { NetWorthSnapshotCronService } from './net-worth-snapshot-cron.service';
import { HolidayCronService } from './holiday-cron.service';

// 스케줄 기반 유지보수 — 알림 자동생성 + 휴지통 자동삭제 + 보안점수 스냅샷 + DB 백업 + 월간 AI 리포트 + 반복거래/반복매수 + 순자산 스냅샷 + 공휴일 사전 캐싱.
// 각 작업은 @Job(core-jobs)으로 등록 — 스케줄러(JobsModule)와 실행 기록 저장소는 AppModule 에서 한 번 등록한다
@Module({
  imports: [PushModule, AiModule, TransactionModule, InvestmentModule, AssetModule, SystemLogModule, HolidayModule],
  providers: [
    NotificationCronService, TrashCronService, SecuritySnapshotCronService,
    DbBackupCronService, AiReportCronService, RecurringCronService,
    NetWorthSnapshotCronService, HolidayCronService,
  ],
})
export class MaintenanceModule {}
