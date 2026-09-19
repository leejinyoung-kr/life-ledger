import { Module } from '@nestjs/common';
import { NotificationModule } from '@leejinyoun/core-notification';
import { env } from '../config/env';
import { PrismaModule } from '../prisma/prisma.module';
import { SystemLogModule } from '../system-log/system-log.module';
import { PushController } from './push.controller';
import { WebPushChannel } from './webpush.channel';
import { PushService } from './push.service';
import { PrismaOutboxStore } from './outbox.store';

// Web Push 구독 관리 + 발송. 발송은 아웃박스를 거친다(알림 행과 같은 트랜잭션에 적재 → 커밋돼야 나감).
// 다른 모듈(알림 크론·인증·파일)이 PushService 로 적재하도록 export
@Module({
  imports: [
    PrismaModule,
    NotificationModule.forRoot({
      webPush: {
        publicKey: env.VAPID_PUBLIC_KEY,
        privateKey: env.VAPID_PRIVATE_KEY,
        subject: env.VAPID_SUBJECT,
      },
      // VAPID 를 비워 푸시를 끄는 것은 의도된 설정이라 required 에 넣지 않는다(.env.example 참고)
      outbox: {
        store: PrismaOutboxStore,
        channels: [WebPushChannel],
        imports: [PrismaModule, SystemLogModule],
      },
    }),
  ],
  controllers: [PushController],
  providers: [PushService],
  exports: [PushService],
})
export class PushModule {}
