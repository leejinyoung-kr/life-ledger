import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from '../auth/auth-user';

// 마스터 잠금이 켜진 사용자는 reveal 류 호출 시 유효한 vault 토큰(x-vault-token)을 요구.
// 미설정 사용자는 그대로 통과한다. 잠김/만료 시 423(Locked) + code:VAULT_LOCKED 로 응답해 프론트가 잠금해제 모달을 띄운다.
@Injectable()
export class VaultGuard implements CanActivate {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    const user = req.user;
    if (!user) return true; // 인증은 JwtAuthGuard 가 담당

    const settings = await this.prisma.userSettings.findUnique({
      where: { user_id: user.id },
      select: { master_lock_enabled: true },
    });
    if (!settings?.master_lock_enabled) return true;

    const header = req.headers['x-vault-token'];
    const token = Array.isArray(header) ? header[0] : header;
    if (!token) this.locked('보관함이 잠겨 있습니다. 마스터 비밀번호로 잠금을 해제하세요.');

    try {
      // vault 전용 시크릿·알고리즘은 SecurityModule 의 JwtModule 설정으로 검증된다
      const payload = this.jwt.verify<{ sub: number; type: string }>(token!);
      if (payload.type !== 'vault' || payload.sub !== user.id) throw new Error('invalid');
    } catch {
      this.locked('보관함 잠금이 만료되었습니다. 다시 잠금을 해제하세요.');
    }
    return true;
  }

  // 잠김 응답 — 프론트가 401(재로그인)과 구분하도록 423 + 코드 사용
  private locked(message: string): never {
    throw new HttpException({ message, code: 'VAULT_LOCKED' }, HttpStatus.LOCKED);
  }
}
