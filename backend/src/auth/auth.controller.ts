import {
  Controller,
  Delete,
  Get,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';
import { ApiExcludeController } from '@nestjs/swagger';
import type { CookieOptions, Request, Response } from 'express';
import { CurrentUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';
import { GoogleAuthGuard } from './guards/google-auth.guard';
import type { AuthUser } from './strategies/jwt.strategy';
import { AuthService, GoogleUser } from './auth.service';

const REFRESH_COOKIE = 'refresh_token';

// 갱신 토큰 쿠키 옵션 — 운영(교차 도메인)은 SameSite=None+Secure, 개발은 Lax
function refreshCookieOptions(): CookieOptions {
  const isProd = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7일
  };
}

@ApiExcludeController()
@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private configService: ConfigService,
  ) {}

  // 현재 로그인 사용자 (토큰 필요) — 사이드바/설정 표시용
  @Get('me')
  me(@CurrentUser() user: AuthUser): AuthUser {
    return user;
  }

  // 계정 영구 삭제 (토큰 필요) — 전 도메인 데이터 + 사용자 제거
  @Delete('me')
  deleteAccount(@CurrentUser() user: AuthUser) {
    return this.authService.deleteAccount(user.id);
  }

  @Public()
  @Get('google')
  @UseGuards(AuthGuard('google'))
  googleAuth() {}

  @Public()
  @Get('google/callback')
  @UseGuards(GoogleAuthGuard)
  async googleCallback(
    @Req() req: Request & { user?: GoogleUser },
    @Res() res: Response,
  ) {
    const frontendUrl = this.configService.getOrThrow('FRONTEND_URL');

    // 화이트리스트 외 계정 등 인증 실패 — 프론트 로그인으로 에러 리다이렉트
    if (!req.user) {
      return res.redirect(`${frontendUrl}/login?error=not_allowed`);
    }

    // 기기/IP 추출 — 신규 기기 로그인 감지용
    const fwd = req.headers['x-forwarded-for'];
    const ip = (Array.isArray(fwd) ? fwd[0] : fwd?.split(',')[0]) ?? req.ip;
    const { access, refresh } = await this.authService.login(req.user, {
      ip: ip?.trim(),
      userAgent: req.headers['user-agent'],
    });
    // refresh 는 httpOnly 쿠키로만, access 는 쿼리로 프론트에 전달
    res.cookie(REFRESH_COOKIE, refresh, refreshCookieOptions());
    res.redirect(`${frontendUrl}/auth/callback?token=${access}`);
  }

  // 갱신 토큰(쿠키)으로 새 access 발급 — access 만료 시 프론트가 호출
  // 무제한 리프레시 시도 방지 — 분당 30회 제한
  @Public()
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @Post('refresh')
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token = (req.cookies?.[REFRESH_COOKIE] as string | undefined) ?? '';
    const access = await this.authService.refresh(token);
    return { token: access };
  }

  // 로그아웃 — refresh 쿠키 제거 (access 는 클라이언트가 폐기)
  @Public()
  @Post('logout')
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(REFRESH_COOKIE, {
      ...refreshCookieOptions(),
      maxAge: undefined,
    });
    return { ok: true };
  }
}
