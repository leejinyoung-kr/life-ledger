import { Module } from '@nestjs/common';
import { StorageModule } from '@leejinyoun/core-storage';
import { env } from '../config/env';
import { NotificationModule } from '../notification/notification.module';
import { PushModule } from '../push/push.module';
import { FileController } from './file.controller';
import { FileService } from './file.service';
import { SystemLogModule } from '../system-log/system-log.module';

@Module({
  imports: [
    NotificationModule,
    PushModule,
    SystemLogModule,
    StorageModule.forRoot({
      bucket: env.B2_BUCKET_NAME,
      endpoint: env.B2_ENDPOINT,
      region: env.B2_BUCKET_REGION,
      accessKeyId: env.B2_KEY_ID,
      secretAccessKey: env.B2_APPLICATION_KEY,
    }),
  ],
  controllers: [FileController],
  providers: [FileService],
})
export class FileModule {}
