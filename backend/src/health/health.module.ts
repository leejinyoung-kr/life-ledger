import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';

// PrismaService 는 전역(@Global) 모듈이라 별도 import 없이 주입된다.
@Module({
  controllers: [HealthController],
})
export class HealthModule {}
