import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

// 메일 발송 페이로드 — 본문은 text/html 중 하나 이상 필수
export interface MailPayload {
  to: string;
  subject: string;
  text?: string;
  html?: string;
}

@Injectable()
export class MailService implements OnModuleInit {
  private readonly logger = new Logger(MailService.name);
  private enabled = false;
  private transporter: Transporter | null = null;
  private from = 'DocNexus <no-reply@docnexus.local>';

  constructor(private config: ConfigService) {}

  // 부팅 시 SMTP 설정 유무로 활성화 결정 — 호스트/계정 없으면 발송 전체 비활성(no-op)
  onModuleInit(): void {
    const host = this.config.get<string>('SMTP_HOST');
    const port = Number(this.config.get<string>('SMTP_PORT') ?? 587);
    const user = this.config.get<string>('SMTP_USER');
    const pass = this.config.get<string>('SMTP_PASS');
    const from = this.config.get<string>('SMTP_FROM');

    if (!host || !user || !pass) {
      this.logger.warn('SMTP 설정 없음 — 메일 발송 비활성 (sendMail no-op)');
      return;
    }

    this.transporter = nodemailer.createTransport({
      host,
      port,
      // 465=암시적 TLS(secure), 그 외(587 등)=STARTTLS
      secure: port === 465,
      auth: { user, pass },
    });
    this.from = from ?? `DocNexus <${user}>`;
    this.enabled = true;
    this.logger.log(`메일 발송 활성화됨 (SMTP ${host}:${port})`);
  }

  get isEnabled(): boolean {
    return this.enabled;
  }

  // 범용 메일 발송 — 비활성이면 false 반환(예외 던지지 않음). 발송 실패도 false 로 흡수해 호출부 흐름 보호
  async sendMail(payload: MailPayload): Promise<boolean> {
    if (!this.enabled || !this.transporter) {
      this.logger.warn(`메일 비활성 — 발송 건너뜀 (to=${payload.to})`);
      return false;
    }
    try {
      await this.transporter.sendMail({
        from: this.from,
        to: payload.to,
        subject: payload.subject,
        text: payload.text,
        html: payload.html,
      });
      return true;
    } catch (err) {
      this.logger.error(`메일 발송 실패 (to=${payload.to})`, err as Error);
      return false;
    }
  }

  // 로그인 인증코드 발송 — 추후 이메일 코드 로그인에서 사용
  async sendLoginCode(to: string, code: string): Promise<boolean> {
    return this.sendMail({
      to,
      subject: `[DocNexus] 로그인 인증코드: ${code}`,
      text: `DocNexus 로그인 인증코드는 ${code} 입니다. 5분 내에 입력하세요.\n본인이 요청하지 않았다면 이 메일을 무시하세요.`,
      html: `
        <div style="font-family:sans-serif;max-width:420px;margin:0 auto">
          <h2 style="font-size:18px;margin:0 0 12px">DocNexus 로그인 인증코드</h2>
          <p style="font-size:14px;color:#444">아래 코드를 로그인 화면에 입력하세요. 유효시간 5분.</p>
          <div style="font-size:30px;font-weight:700;letter-spacing:6px;text-align:center;padding:16px;background:#f4f4f5;border-radius:8px;margin:16px 0">${code}</div>
          <p style="font-size:12px;color:#888">본인이 요청하지 않았다면 이 메일을 무시하세요.</p>
        </div>`,
    });
  }
}
