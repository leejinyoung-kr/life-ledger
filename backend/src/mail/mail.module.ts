import { Global, Module } from '@nestjs/common';
import { NotificationModule } from '@leejinyoun/core-notification';
import { MailService } from './mail.service';

// SMTP 메일 발송 인프라 — 인증(이메일 코드) 등 여러 모듈에서 주입하므로 전역 모듈로 노출
@Global()
@Module({
  imports: [
    NotificationModule.forRoot({
      mail: {
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined,
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
        from: process.env.SMTP_FROM ?? `DocNexus <${process.env.SMTP_USER}>`,
      },
    }),
  ],
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
