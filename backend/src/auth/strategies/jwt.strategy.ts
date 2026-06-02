import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

// JWT payload 구조 (auth.service.login 에서 sign 한 형태)
export interface JwtPayload {
  sub: number;
  googleId: string;
  email: string;
  name: string;
  picture: string;
}

// 컨트롤러에서 @CurrentUser() 로 받는 인증 사용자
export interface AuthUser {
  id: number;
  email: string;
  name: string;
  picture: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow('JWT_SECRET'),
    });
  }

  // 검증된 payload 를 req.user 로 주입 (sub → id 로 변환)
  validate(payload: JwtPayload): AuthUser {
    return {
      id: payload.sub,
      email: payload.email,
      name: payload.name,
      picture: payload.picture,
    };
  }
}
