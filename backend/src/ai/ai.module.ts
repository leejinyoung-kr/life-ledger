import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { SystemLogModule } from '../system-log/system-log.module';

// 월간 리포트 자동생성 크론(MaintenanceModule)이 AiService를 재사용하도록 export
@Module({
  imports: [PrismaModule, SystemLogModule],
  controllers: [AiController],
  providers: [AiService],
  exports: [AiService],
})
export class AiModule {}
