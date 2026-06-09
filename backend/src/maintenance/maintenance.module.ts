import { Module } from '@nestjs/common';
import { PushModule } from '../push/push.module';
import { NotificationCronService } from './notification-cron.service';
import { TrashCronService } from './trash-cron.service';
import { SecuritySnapshotCronService } from './security-snapshot-cron.service';

// 스케줄 기반 유지보수 — 알림 자동생성(R4·비번회전) + 휴지통 자동삭제(R6) + 보안점수 스냅샷(17a)
@Module({
  imports: [PushModule],
  providers: [NotificationCronService, TrashCronService, SecuritySnapshotCronService],
})
export class MaintenanceModule {}
