import { Controller, Post, Req, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { Public } from '@leejinyoung-kr/core-auth';
import { AuthService } from './auth.service';
import {
  HAS_SESSION_COOKIE,
  REFRESH_COOKIE,
  clientIp,
  hasSessionCookieOptions,
  refreshCookieOptions,
} from './auth.controller';

// 데모 로그인 — 로그인 없이 데모 사용자로 둘러보기. AuthModule 이 DEMO_MODE 일 때만 이 컨트롤러를 등록한다
@ApiExcludeController()
@Controller('auth')
export class DemoAuthController {
  constructor(private authService: AuthService) {}

  // 데모 사용자 세션 발급 — refresh 는 httpOnly 쿠키, access 는 응답 본문(이메일 로그인과 같은 방식). 분당 10회 제한
  @Public()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('demo')
  async demoLogin(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const { access, refresh, refreshTtlMs } = await this.authService.demoLogin({
      ip: clientIp(req),
      userAgent: req.headers['user-agent'],
    });
    res.cookie(REFRESH_COOKIE, refresh, refreshCookieOptions(refreshTtlMs));
    res.cookie(HAS_SESSION_COOKIE, '1', hasSessionCookieOptions(refreshTtlMs));
    return { token: access };
  }
}
