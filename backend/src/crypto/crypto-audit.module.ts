import { Module } from '@nestjs/common';
import { CIPHER_STORE, PrismaCipherStore } from './cipher-store';
import { CryptoAuditService } from './crypto-audit.service';
import { CryptoBootstrapService } from './crypto-bootstrap.service';

// 암호문 점검·재암호화 — CryptoService(전역 CryptoModule)·PrismaService(전역 PrismaModule)를 쓴다
@Module({
  providers: [
    { provide: CIPHER_STORE, useClass: PrismaCipherStore },
    CryptoAuditService,
    CryptoBootstrapService,
  ],
})
export class CryptoAuditModule {}
