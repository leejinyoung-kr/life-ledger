import { BadRequestException, ForbiddenException, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { DEFAULT_CATEGORIES } from '../settings/settings.defaults';
import { AccessLogService } from '../access-log/access-log.service';
import type { ClientInfo } from '@leejinyoung-kr/core-logging';
import { MIN_MASTER_PASSWORD } from './dto/vault.dto';

// 잠김 응답 — 프론트가 401(재로그인)과 구분하도록 423 + 코드 사용
function vaultLocked(message: string): never {
  throw new HttpException({ message, code: 'VAULT_LOCKED' }, HttpStatus.LOCKED);
}

// 마스터 잠금(보관함 2차 잠금) — 마스터 비번 해시 관리 + 잠금해제 토큰 발급.
// Google 로그인 외에 민감 보관함 진입 시 별도 비번을 요구해 reveal 류 호출을 막는다.
@Injectable()
export class VaultService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private accessLog: AccessLogService,
  ) {}

  // 마스터 비번 → scrypt 해시 문자열(saltHex:hashHex)
  private hash(pw: string): string {
    const salt = randomBytes(16);
    const dk = scryptSync(pw, salt, 32);
    return `${salt.toString('hex')}:${dk.toString('hex')}`;
  }

  // 저장 해시와 입력 비번을 상수시간 비교
  private matches(pw: string, stored: string): boolean {
    const [saltHex, hashHex] = stored.split(':');
    if (!saltHex || !hashHex) return false;
    const dk = scryptSync(pw, Buffer.from(saltHex, 'hex'), 32);
    const orig = Buffer.from(hashHex, 'hex');
    return dk.length === orig.length && timingSafeEqual(dk, orig);
  }

  // 설정 행 보장(없으면 기본값으로 생성) — 마스터 잠금 필드만 다룬다
  private async ensureSettings(userId: number) {
    const row = await this.prisma.userSettings.findUnique({ where: { user_id: userId } });
    if (row) return row;
    return this.prisma.userSettings.create({
      data: {
        user_id: userId,
        categories: DEFAULT_CATEGORIES,
      },
    });
  }

  // 잠금 상태 조회 (활성 여부 + 자동잠금 분)
  async status(userId: number) {
    const row = await this.prisma.userSettings.findUnique({
      where: { user_id: userId },
      select: { master_lock_enabled: true, master_lock_timeout: true },
    });
    return {
      enabled: row?.master_lock_enabled ?? false,
      timeoutMin: row?.master_lock_timeout ?? 5,
    };
  }

  // 마스터 잠금 설정/변경 — 비번 해시 저장 + 활성화. 변경 시 현재 비번 확인은 컨트롤러의 VaultGuard 가 맡는다
  async setup(userId: number, password: string, timeoutMin: number) {
    if (!password || password.length < MIN_MASTER_PASSWORD) {
      throw new BadRequestException(`마스터 비밀번호는 ${MIN_MASTER_PASSWORD}자 이상이어야 합니다.`);
    }
    await this.ensureSettings(userId);
    await this.prisma.userSettings.update({
      where: { user_id: userId },
      data: {
        master_lock_enabled: true,
        master_lock_hash: this.hash(password),
        master_lock_timeout: Math.max(0, Math.min(timeoutMin ?? 5, 1440)),
      },
    });
    return { enabled: true };
  }

  // 마스터 잠금 해제(비활성화) — 현재 비번 확인 후 해제
  async disable(userId: number, password: string, client?: ClientInfo) {
    const row = await this.ensureSettings(userId);
    if (row.master_lock_enabled && row.master_lock_hash && !this.matches(password, row.master_lock_hash)) {
      throw new ForbiddenException('마스터 비밀번호가 일치하지 않습니다.');
    }
    await this.prisma.userSettings.update({
      where: { user_id: userId },
      data: { master_lock_enabled: false, master_lock_hash: null },
    });
    await this.accessLog.log(userId, 'vault_disable', { type: 'security', id: userId, name: 'vault' }, client);
    return { enabled: false };
  }

  // 마스터 잠금이 켜진 사용자면 유효한 vault 토큰을 요구 — 잠김/만료 시 423 + code:VAULT_LOCKED (VaultGuard·조건부 잠금 공용)
  async assertUnlocked(userId: number, token: string | undefined): Promise<void> {
    const settings = await this.prisma.userSettings.findUnique({
      where: { user_id: userId },
      select: { master_lock_enabled: true },
    });
    if (!settings?.master_lock_enabled) return;
    if (!token) vaultLocked('보관함이 잠겨 있습니다. 마스터 비밀번호로 잠금을 해제하세요.');
    try {
      // vault 전용 시크릿·알고리즘은 SecurityModule 의 JwtModule 설정으로 검증된다
      const payload = this.jwt.verify<{ sub: number; type: string }>(token);
      if (payload.type !== 'vault' || payload.sub !== userId) throw new Error('invalid');
    } catch {
      vaultLocked('보관함 잠금이 만료되었습니다. 다시 잠금을 해제하세요.');
    }
  }

  // 잠금 해제 — 비번 확인 후 만료시간이 있는 vault 토큰 발급. 자동잠금=토큰 만료
  async unlock(userId: number, password: string, client?: ClientInfo) {
    const row = await this.ensureSettings(userId);
    if (!row.master_lock_enabled || !row.master_lock_hash) {
      throw new BadRequestException('마스터 잠금이 설정되어 있지 않습니다.');
    }
    if (!this.matches(password, row.master_lock_hash)) {
      throw new ForbiddenException('마스터 비밀번호가 일치하지 않습니다.');
    }
    // timeout 0(수동 잠금만) 은 12시간으로 길게 둔다
    const ttlSec = row.master_lock_timeout > 0 ? row.master_lock_timeout * 60 : 12 * 3600;
    // type 을 access 와 다르게 두어 Bearer 로 넣어도 JwtStrategy 가 거부한다(시크릿 분리와 이중 방어)
    const token = this.jwt.sign({ sub: userId, type: 'vault' }, { expiresIn: ttlSec });
    await this.accessLog.log(userId, 'vault_unlock', { type: 'security', id: userId, name: 'vault' }, client);
    return { token, expiresIn: ttlSec };
  }
}
