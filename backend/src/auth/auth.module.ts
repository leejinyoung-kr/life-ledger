import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { AuthModule as CoreAuthModule } from '@leejinyoun/core-auth';
import { PushModule } from '../push/push.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JWT_AUDIENCE, JWT_ISSUER } from './jwt.constants';

@Module({
  imports: [
    PushModule,
    CoreAuthModule.forRoot({
      jwtSecret: process.env.JWT_SECRET!,
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
      strategies: ['google', 'jwt'],
      google: {
        clientID: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        callbackURL: process.env.GOOGLE_CALLBACK_URL!,
        allowedEmails: (process.env.ALLOWED_EMAILS ?? '')
          .split(',')
          .map((e) => e.trim())
          .filter(Boolean),
      },
    }),
    // 기본 시크릿은 access 토큰용. refresh 토큰은 AuthService 가 JWT_REFRESH_SECRET 을 직접 지정해 서명·검증한다
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow('JWT_SECRET'),
        signOptions: { expiresIn: '7d' },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}
