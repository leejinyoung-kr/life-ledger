import { Global, Module } from '@nestjs/common';
import { NotificationModule } from '@leejinyoung-kr/core-notification';
import { env } from '../config/env';
import { MailService } from './mail.service';

// SMTP 메일 발송 인프라 — 인증(이메일 코드) 등 여러 모듈에서 주입하므로 전역 모듈로 노출
@Global()
@Module({
  imports: [
    NotificationModule.forRoot({
      mail: {
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        user: env.SMTP_USER,
        pass: env.SMTP_PASS,
        from: env.SMTP_FROM ?? `DocNexus <${env.SMTP_USER}>`,
      },
    }),
  ],
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
