import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { JWT_ALGORITHMS } from '../auth/jwt.constants';
import { env } from '../config/env';
import { SecurityController } from './security.controller';
import { SecurityService } from './security.service';
import { VaultService } from './vault.service';
import { VaultGuard } from './vault.guard';

// 보안(세션 · 열람 기록) + 마스터 잠금. @Global 로 VaultGuard·SecurityService 를 보관함 모듈에서 주입 가능하게 한다.
// JwtModule 도 함께 export 해야 VaultGuard 가 다른 모듈(@UseGuards) 컨텍스트에서 인스턴스화될 때 JwtService 를 주입받을 수 있다.
// 이 JwtModule 은 vault 토큰 전용 — access 와 다른 시크릿(JWT_VAULT_SECRET)이라 서로의 토큰이 검증을 통과하지 못한다.
@Global()
@Module({
  imports: [
    JwtModule.register({
      secret: env.JWT_VAULT_SECRET,
      verifyOptions: { algorithms: JWT_ALGORITHMS },
    }),
  ],
  controllers: [SecurityController],
  providers: [SecurityService, VaultService, VaultGuard],
  exports: [JwtModule, SecurityService, VaultService, VaultGuard],
})
export class SecurityModule {}
