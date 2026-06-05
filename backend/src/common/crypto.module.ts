import { Global, Module } from '@nestjs/common';
import { CryptoService } from './crypto.service';

// 전역 암호화 모듈 — 보관함(신원/계정/ENV) 서비스가 CryptoService 주입받아 사용
@Global()
@Module({
  providers: [CryptoService],
  exports: [CryptoService],
})
export class CryptoModule {}
