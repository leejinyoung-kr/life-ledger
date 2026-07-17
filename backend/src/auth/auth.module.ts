import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { AuthModule as CoreAuthModule } from '@leejinyoun/core-auth';
import { PushModule } from '../push/push.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

@Module({
  imports: [
    PushModule,
    CoreAuthModule.forRoot({
      jwtSecret: process.env.JWT_SECRET!,
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
