import { ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Profile, Strategy, VerifyCallback } from 'passport-google-oauth20';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  // 허용 이메일 화이트리스트 — 본인 외 인가 차단(개인 서비스)
  private readonly allowedEmails: string[];

  constructor(configService: ConfigService) {
    super({
      clientID: configService.getOrThrow('GOOGLE_CLIENT_ID'),
      clientSecret: configService.getOrThrow('GOOGLE_CLIENT_SECRET'),
      callbackURL: configService.getOrThrow('GOOGLE_CALLBACK_URL'),
      scope: ['email', 'profile'],
    });
    this.allowedEmails = (configService.get<string>('ALLOWED_EMAILS') ?? '')
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
  }

  // OAuth 프로필 검증 — 화이트리스트 외 이메일은 User 생성 전에 차단
  validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ) {
    const { id, displayName, emails, photos } = profile;
    const email = emails?.[0]?.value ?? '';

    if (this.allowedEmails.length && !this.allowedEmails.includes(email.toLowerCase())) {
      return done(new ForbiddenException('허용되지 않은 계정입니다.'), undefined);
    }

    done(null, {
      googleId: id,
      email,
      name: displayName,
      picture: photos?.[0]?.value ?? '',
    });
  }
}
