import { Controller, Delete, Get, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { CurrentUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';
import type { AuthUser } from './strategies/jwt.strategy';
import { AuthService, GoogleUser } from './auth.service';

const REFRESH_COOKIE = 'refresh_token';

// 갱신 토큰 쿠키 옵션 — 운영(교차 도메인)은 SameSite=None+Secure, 개발은 Lax
function refreshCookieOptions() {
  const isProd = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: (isProd ? 'none' : 'lax') as 'none' | 'lax',
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
  @UseGuards(AuthGuard('google'))
  async googleCallback(@Req() req: Request & { user: GoogleUser }, @Res() res: Response) {
    const { access, refresh } = await this.authService.login(req.user);
    // refresh 는 httpOnly 쿠키로만, access 는 쿼리로 프론트에 전달
    res.cookie(REFRESH_COOKIE, refresh, refreshCookieOptions());
    const frontendUrl = this.configService.getOrThrow('FRONTEND_URL');
    res.redirect(`${frontendUrl}/auth/callback?token=${access}`);
  }

  // 갱신 토큰(쿠키)으로 새 access 발급 — access 만료 시 프론트가 호출
  @Public()
  @Post('refresh')
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = (req.cookies?.[REFRESH_COOKIE] as string | undefined) ?? '';
    const access = await this.authService.refresh(token);
    return { token: access };
  }

  // 로그아웃 — refresh 쿠키 제거 (access 는 클라이언트가 폐기)
  @Public()
  @Post('logout')
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(REFRESH_COOKIE, { ...refreshCookieOptions(), maxAge: undefined });
    return { ok: true };
  }
}
