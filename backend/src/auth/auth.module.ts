import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthModule as CoreAuthModule } from '@leejinyoung-kr/core-auth';
import { env } from '../config/env';
import { NotificationModule } from '../notification/notification.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JWT_AUDIENCE, JWT_ISSUER } from './jwt.constants';

@Module({
  imports: [
    NotificationModule,
    CoreAuthModule.forRoot({
      jwtSecret: env.JWT_SECRET,
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
      strategies: ['google', 'jwt'],
      google: {
        clientID: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
        callbackURL: env.GOOGLE_CALLBACK_URL,
        allowedEmails: env.ALLOWED_EMAILS,
      },
    }),
    // 기본 시크릿은 access 토큰용. refresh 토큰은 AuthService 가 JWT_REFRESH_SECRET 을 직접 지정해 서명·검증한다
    JwtModule.register({
      secret: env.JWT_SECRET,
      signOptions: { expiresIn: '7d' },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}
