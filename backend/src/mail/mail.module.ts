import { Global, Module } from '@nestjs/common';
import { MailService } from './mail.service';

// SMTP 메일 발송 인프라 — 인증(이메일 코드) 등 여러 모듈에서 주입하므로 전역 모듈로 노출
@Global()
@Module({
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
