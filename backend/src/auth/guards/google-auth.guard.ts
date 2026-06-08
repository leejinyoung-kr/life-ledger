import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

// Google OAuth 가드 — 인증 실패 시 기본 401 throw 대신 user=null 반환(컨트롤러가 프론트로 리다이렉트 처리)
@Injectable()
export class GoogleAuthGuard extends AuthGuard('google') {
  handleRequest<TUser = unknown>(_err: unknown, user: TUser): TUser {
    return (user ?? null) as TUser;
  }
}
