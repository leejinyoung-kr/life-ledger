import { Global, Module } from '@nestjs/common';
import { AccessLogService } from './access-log.service';

// 전역 접근 감사 로그 모듈 — 보관함(계정/신원) 서비스가 열람 시 주입받아 기록, 보안센터가 조회
@Global()
@Module({
  providers: [AccessLogService],
  exports: [AccessLogService],
})
export class AccessLogModule {}
