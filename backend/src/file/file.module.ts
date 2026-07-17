import { Module } from '@nestjs/common';
import { StorageModule } from '@leejinyoun/core-storage';
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
      bucket: process.env.B2_BUCKET_NAME!,
      endpoint: process.env.B2_ENDPOINT!,
      region: process.env.B2_BUCKET_REGION!,
      accessKeyId: process.env.B2_KEY_ID!,
      secretAccessKey: process.env.B2_APPLICATION_KEY!,
    }),
  ],
  controllers: [FileController],
  providers: [FileService],
})
export class FileModule {}
