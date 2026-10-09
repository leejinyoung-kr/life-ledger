import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import type { AuthUser } from '../auth/auth-user';
import { VaultService } from './vault.service';

// 마스터 잠금이 켜진 사용자는 reveal 류 호출 시 유효한 vault 토큰(x-vault-token)을 요구.
// 미설정 사용자는 그대로 통과한다. 잠김/만료 시 423(Locked) + code:VAULT_LOCKED 로 응답해 프론트가 잠금해제 모달을 띄운다.
@Injectable()
export class VaultGuard implements CanActivate {
  constructor(private vault: VaultService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    const user = req.user;
    if (!user) return true; // 인증은 JwtAuthGuard 가 담당
    await this.vault.assertUnlocked(user.id, vaultTokenOf(req));
    return true;
  }
}

// 요청 헤더에서 vault 토큰 추출 (x-vault-token)
export function vaultTokenOf(req: Request): string | undefined {
  const header = req.headers['x-vault-token'];
  return Array.isArray(header) ? header[0] : header;
}
