import { Injectable } from '@nestjs/common';
import { MailService as CoreMailService } from '@leejinyoun/core-notification';

@Injectable()
export class MailService {
  constructor(private mail: CoreMailService) {}

  get isEnabled(): boolean {
    return this.mail.isEnabled;
  }

  // 로그인 인증코드 발송 — 이메일 코드 로그인에서 사용
  async sendLoginCode(to: string, code: string): Promise<boolean> {
    return this.mail.sendMail({
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
