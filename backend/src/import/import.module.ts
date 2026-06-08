import { Module } from '@nestjs/common';
import { ImportController } from './import.controller';
import { ImportService } from './import.service';

// 데이터 가져오기 — 계정 보관함 JSON 백업 복원(export 역방향)
@Module({
  controllers: [ImportController],
  providers: [ImportService],
})
export class ImportModule {}
