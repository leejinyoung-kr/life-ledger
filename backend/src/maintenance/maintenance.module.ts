import { Module } from '@nestjs/common';
import { NotificationCronService } from './notification-cron.service';
import { TrashCronService } from './trash-cron.service';

// 스케줄 기반 유지보수 — 알림 자동생성(R4) + 휴지통 자동삭제(R6)
@Module({
  providers: [NotificationCronService, TrashCronService],
})
export class MaintenanceModule {}
