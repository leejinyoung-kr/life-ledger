import { Module } from '@nestjs/common';
import { PushModule } from '../push/push.module';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';

// 파일 업로드 등 다른 모듈에서 알림을 생성할 수 있도록 NotificationService를 export.
// PushModule 은 알림과 같은 트랜잭션에 푸시를 적재하기 위해 필요
@Module({
  imports: [PushModule],
  controllers: [NotificationController],
  providers: [NotificationService],
  exports: [NotificationService],
})
export class NotificationModule {}
