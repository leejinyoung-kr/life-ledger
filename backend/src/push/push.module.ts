import { Module } from '@nestjs/common';
import { NotificationModule } from '@leejinyoun/core-notification';
import { env } from '../config/env';
import { PrismaModule } from '../prisma/prisma.module';
import { PushController } from './push.controller';
import { PushService } from './push.service';

// Web Push 구독 관리 + 발송. 다른 모듈(알림 크론·인증)이 PushService 로 발송하도록 export
@Module({
  imports: [
    PrismaModule,
    NotificationModule.forRoot({
      webPush: {
        publicKey: env.VAPID_PUBLIC_KEY,
        privateKey: env.VAPID_PRIVATE_KEY,
        subject: env.VAPID_SUBJECT,
      },
    }),
  ],
  controllers: [PushController],
  providers: [PushService],
  exports: [PushService],
})
export class PushModule {}
