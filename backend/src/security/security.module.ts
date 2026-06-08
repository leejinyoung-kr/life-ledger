import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { SecurityController } from './security.controller';
import { SecurityService } from './security.service';
import { VaultService } from './vault.service';
import { VaultGuard } from './vault.guard';

// 보안 센터 + 마스터 잠금. @Global 로 VaultGuard·SecurityService 를 보관함/크론 모듈에서 주입 가능하게 한다.
@Global()
@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow('JWT_SECRET'),
      }),
    }),
  ],
  controllers: [SecurityController],
  providers: [SecurityService, VaultService, VaultGuard],
  exports: [SecurityService, VaultService, VaultGuard],
})
export class SecurityModule {}
