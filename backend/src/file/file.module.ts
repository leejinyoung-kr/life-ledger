import { Module } from '@nestjs/common';
import { NotificationModule } from '../notification/notification.module';
import { PushModule } from '../push/push.module';
import { FileController } from './file.controller';
import { FileService } from './file.service';

@Module({
  imports: [NotificationModule, PushModule],
  controllers: [FileController],
  providers: [FileService],
})
export class FileModule {}
