import { Module } from '@nestjs/common';
import { PushModule } from '../push/push.module';
import { AiModule } from '../ai/ai.module';
import { TransactionModule } from '../transaction/transaction.module';
import { InvestmentModule } from '../investment/investment.module';
import { AssetModule } from '../asset/asset.module';
import { SystemLogModule } from '../system-log/system-log.module';
// [발표용 임시] 전체 크론 중단 — 발표 끝나면 아래 import 원복할 것
// import { NotificationCronService } from './notification-cron.service';
// import { TrashCronService } from './trash-cron.service';
// import { SecuritySnapshotCronService } from './security-snapshot-cron.service';
// import { DbBackupCronService } from './db-backup-cron.service';
// import { AiReportCronService } from './ai-report-cron.service';
// import { RecurringCronService } from './recurring-cron.service';
// import { NetWorthSnapshotCronService } from './net-worth-snapshot-cron.service';

// 스케줄 기반 유지보수 — 알림 자동생성 + 휴지통 자동삭제 + 보안점수 스냅샷 + DB 백업 + 월간 AI 리포트 + 반복거래/반복매수 + 순자산 스냅샷
// [발표용 임시] 전체 크론 중단 — 발표 끝나면 아래 providers 배열 원복할 것
@Module({
  imports: [PushModule, AiModule, TransactionModule, InvestmentModule, AssetModule, SystemLogModule],
  providers: [
    // NotificationCronService, TrashCronService, SecuritySnapshotCronService,
    // DbBackupCronService, AiReportCronService, RecurringCronService,
    // NetWorthSnapshotCronService,
  ],
})
export class MaintenanceModule {}
