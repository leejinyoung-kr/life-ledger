import { createHash, randomInt, randomUUID } from 'node:crypto';
import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { PushService } from '../push/push.service.js';
import { MailService } from '../mail/mail.service.js';

export interface GoogleUser {
  googleId: string;
  email: string;
  name: string;
  picture: string;
}

// 로그인 클라이언트 정보 (기기 감지용)
export interface LoginClient {
  ip?: string;
  userAgent?: string;
}

// 토큰 수명 — Access 짧게(자주 갱신), Refresh 길게(쿠키 보관)
const ACCESS_TTL = '15m';
const REFRESH_TTL = '7d';
const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// 이메일 로그인 코드 — 6자리, 5분 만료, 최대 5회 검증 시도
const EMAIL_CODE_TTL_MS = 5 * 60 * 1000;
const EMAIL_CODE_MAX_ATTEMPTS = 5;

// User-Agent → 기기 표기/종류 추정 (간이)
function parseDevice(ua = ''): { device: string; type: 'desktop' | 'mobile' | 'unknown' } {
  if (!ua) return { device: '알 수 없는 기기', type: 'unknown' };
  const mobile = /Mobile|Android|iPhone|iPad/i.test(ua);
  const browser = /Edg/i.test(ua) ? 'Edge' : /Chrome/i.test(ua) ? 'Chrome' : /Firefox/i.test(ua) ? 'Firefox' : /Safari/i.test(ua) ? 'Safari' : 'Unknown';
  const os = /Windows/i.test(ua) ? 'Windows' : /Mac OS/i.test(ua) ? 'macOS' : /Android/i.test(ua) ? 'Android' : /iPhone|iPad/i.test(ua) ? 'iOS' : /Linux/i.test(ua) ? 'Linux' : '';
  return { device: `${os ? os + ' · ' : ''}${browser}`, type: mobile ? 'mobile' : 'desktop' };
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  // 로그인 허용 이메일 화이트리스트 (구글 전략과 동일 기준) — 비우면 모든 이메일 허용
  private readonly allowedEmails: string[];

  constructor(
    private jwtService: JwtService,
    private prisma: PrismaService,
    private push: PushService,
    private config: ConfigService,
    private mail: MailService,
  ) {
    this.allowedEmails = (this.config.get<string>('ALLOWED_EMAILS') ?? '')
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
  }

  // 이메일이 화이트리스트에 있는지 (비어있으면 전체 허용)
  private isEmailAllowed(email: string): boolean {
    return !this.allowedEmails.length || this.allowedEmails.includes(email.toLowerCase());
  }

  private hashCode(code: string): string {
    return createHash('sha256').update(code).digest('hex');
  }

  // 접근 토큰 — 사용자 정보 포함(JwtStrategy 가 검증)
  private signAccess(user: User): string {
    return this.jwtService.sign(
      {
        sub: user.id,
        googleId: user.google_id,
        email: user.email,
        name: user.name,
        picture: user.picture,
        type: 'access',
      },
      { expiresIn: ACCESS_TTL },
    );
  }

  // 갱신 토큰 — sub + jti(화이트리스트 식별자), httpOnly 쿠키로만 사용
  private signRefresh(userId: number, jti: string): string {
    return this.jwtService.sign({ sub: userId, jti, type: 'refresh' }, { expiresIn: REFRESH_TTL });
  }

  // Google 로그인 시 user upsert 후 access/refresh 토큰 발급. 클라이언트 정보가 있으면 세션 기록·신규 기기 감지
  async login(googleUser: GoogleUser, client?: LoginClient): Promise<{ access: string; refresh: string }> {
    const user = await this.prisma.user.upsert({
      where: { google_id: googleUser.googleId },
      update: {
        email: googleUser.email,
        name: googleUser.name,
        picture: googleUser.picture,
      },
      create: {
        google_id: googleUser.googleId,
        email: googleUser.email,
        name: googleUser.name,
        picture: googleUser.picture,
      },
    });

    return this.issueTokens(user, client);
  }

  // access/refresh 발급 공통 로직 — 세션 기록 후 refresh 화이트리스트에 jti 등록. 구글·이메일 로그인 공유
  private async issueTokens(user: User, client?: LoginClient): Promise<{ access: string; refresh: string }> {
    const sessionId = client ? await this.recordLogin(user.id, client) : null;
    const jti = randomUUID();
    await this.prisma.refreshToken.create({
      data: { user_id: user.id, session_id: sessionId, jti, expires_at: new Date(Date.now() + REFRESH_TTL_MS) },
    });
    return { access: this.signAccess(user), refresh: this.signRefresh(user.id, jti) };
  }

  // 이메일 코드 발송 — 화이트리스트 통과 시 6자리 코드를 메일로 보낸다.
  // 이메일 존재 여부/허용 여부를 응답으로 노출하지 않음(열거 공격 차단) — 항상 동일 결과 반환
  async requestEmailCode(rawEmail: string, client?: LoginClient): Promise<{ ok: true }> {
    const email = rawEmail.trim().toLowerCase();

    // 허용 이메일만 실제 발송. 그 외엔 조용히 무시(응답은 동일)
    if (this.isEmailAllowed(email) && this.mail.isEnabled) {
      const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
      // 이전 미사용 코드 무효화 후 새 코드 저장(해시만)
      await this.prisma.emailLoginCode.updateMany({
        where: { email, consumed_at: null },
        data: { consumed_at: new Date() },
      });
      await this.prisma.emailLoginCode.create({
        data: {
          email,
          code_hash: this.hashCode(code),
          expires_at: new Date(Date.now() + EMAIL_CODE_TTL_MS),
        },
      });
      const sent = await this.mail.sendLoginCode(email, code);
      if (!sent) this.logger.warn(`이메일 코드 발송 실패 (to=${email})`);
    } else if (!this.mail.isEnabled) {
      this.logger.warn('SMTP 비활성 — 이메일 코드 발송 불가');
    }

    return { ok: true };
  }

  // 이메일 코드 검증 → 성공 시 사용자 조회/생성 후 토큰 발급
  async verifyEmailCode(
    rawEmail: string,
    code: string,
    client?: LoginClient,
  ): Promise<{ access: string; refresh: string }> {
    const email = rawEmail.trim().toLowerCase();
    if (!this.isEmailAllowed(email)) {
      throw new UnauthorizedException('허용되지 않은 계정입니다.');
    }

    // 최신 미사용 코드 1건
    const record = await this.prisma.emailLoginCode.findFirst({
      where: { email, consumed_at: null },
      orderBy: { created_at: 'desc' },
    });
    if (!record) throw new BadRequestException('유효한 인증코드가 없습니다. 다시 요청하세요.');

    if (record.expires_at.getTime() < Date.now()) {
      await this.prisma.emailLoginCode.update({ where: { id: record.id }, data: { consumed_at: new Date() } });
      throw new BadRequestException('인증코드가 만료되었습니다. 다시 요청하세요.');
    }
    if (record.attempts >= EMAIL_CODE_MAX_ATTEMPTS) {
      await this.prisma.emailLoginCode.update({ where: { id: record.id }, data: { consumed_at: new Date() } });
      throw new BadRequestException('시도 횟수를 초과했습니다. 다시 요청하세요.');
    }

    // 코드 불일치 — 시도 횟수만 증가
    if (record.code_hash !== this.hashCode(code.trim())) {
      await this.prisma.emailLoginCode.update({ where: { id: record.id }, data: { attempts: { increment: 1 } } });
      throw new BadRequestException('인증코드가 일치하지 않습니다.');
    }

    // 성공 — 코드 소비 후 사용자 조회/생성
    await this.prisma.emailLoginCode.update({ where: { id: record.id }, data: { consumed_at: new Date() } });
    const user = await this.prisma.user.upsert({
      where: { email },
      update: {},
      create: { email, name: email.split('@')[0] },
    });
    return this.issueTokens(user, client);
  }

  // 로그인 세션 기록 — 동일 기기/IP면 활동시각 갱신, 새 조합이면 세션 생성 + (첫 로그인 제외) 새 기기 알림. 발급될 refresh 토큰과 연결할 세션 id 반환
  private async recordLogin(userId: number, client: LoginClient): Promise<number> {
    const { device, type } = parseDevice(client.userAgent);
    const location = client.ip?.slice(0, 100) || '알 수 없음';

    const priorCount = await this.prisma.loginSession.count({ where: { user_id: userId, revoked_at: null } });
    const existing = await this.prisma.loginSession.findFirst({
      where: { user_id: userId, device, location, revoked_at: null },
    });

    // 이번 로그인 기기만 현재 기기로 표시
    await this.prisma.loginSession.updateMany({ where: { user_id: userId }, data: { is_current: false } });

    if (existing) {
      await this.prisma.loginSession.update({
        where: { id: existing.id },
        data: { is_current: true, last_active_at: new Date(), status: 'active' },
      });
      return existing.id;
    }

    const created = await this.prisma.loginSession.create({
      data: { user_id: userId, device, device_type: type, location, is_current: true, status: 'active' },
    });

    // 기존 세션이 있던 사용자에게만 새 기기 알림 (최초 로그인은 제외)
    if (priorCount > 0) {
      await this.prisma.notification.create({
        data: {
          user_id: userId,
          group: 'system',
          tone: 'warning',
          title: '새 기기에서 로그인',
          description: `${device} (${location}) 에서 로그인되었습니다. 본인이 아니라면 보안 센터에서 세션을 로그아웃하세요.`,
          source: '보안',
        },
      });
      // 새 기기 로그인은 보안 이벤트 → 웹 푸시도 발송 (VAPID 비활성 시 no-op)
      await this.push.sendToUser(userId, {
        title: '새 기기에서 로그인',
        body: `${device} (${location}) 에서 로그인되었습니다.`,
        url: '/security',
      });
    }

    return created.id;
  }

  // 갱신 토큰 검증 → 화이트리스트 확인 후 rotation(이전 jti 폐기 + 신규 access/refresh 발급)
  async refresh(refreshToken: string): Promise<{ access: string; refresh: string }> {
    if (!refreshToken) throw new UnauthorizedException('갱신 토큰이 없습니다.');
    let payload: { sub: number; jti?: string; type?: string };
    try {
      payload = this.jwtService.verify(refreshToken);
    } catch {
      throw new UnauthorizedException('갱신 토큰이 유효하지 않습니다.');
    }
    if (payload.type !== 'refresh' || !payload.jti) throw new UnauthorizedException('갱신 토큰이 아닙니다.');

    const stored = await this.prisma.refreshToken.findUnique({ where: { jti: payload.jti } });
    if (!stored || stored.revoked_at || stored.user_id !== payload.sub) {
      throw new UnauthorizedException('갱신 토큰이 유효하지 않습니다.');
    }

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) throw new UnauthorizedException('사용자를 찾을 수 없습니다.');

    const newJti = randomUUID();
    await this.prisma.$transaction([
      this.prisma.refreshToken.update({ where: { id: stored.id }, data: { revoked_at: new Date() } }),
      this.prisma.refreshToken.create({
        data: {
          user_id: user.id,
          session_id: stored.session_id,
          jti: newJti,
          expires_at: new Date(Date.now() + REFRESH_TTL_MS),
        },
      }),
    ]);

    return { access: this.signAccess(user), refresh: this.signRefresh(user.id, newJti) };
  }

  // 로그아웃 — refresh 토큰의 jti 를 화이트리스트에서 폐기 (서명 검증 실패해도 디코드되면 폐기 시도)
  async logout(refreshToken?: string): Promise<void> {
    if (!refreshToken) return;
    let payload: { jti?: string } | null;
    try {
      payload = this.jwtService.verify(refreshToken);
    } catch {
      payload = this.jwtService.decode(refreshToken) as { jti?: string } | null;
    }
    if (!payload?.jti) return;
    await this.prisma.refreshToken.updateMany({
      where: { jti: payload.jti, revoked_at: null },
      data: { revoked_at: new Date() },
    });
  }

  // 계정 영구 삭제 — 전 도메인 데이터 + 사용자 제거 (되돌릴 수 없음)
  // access_log 는 user_id FK cascade 로 함께 삭제되므로 DB 기록 대신 서버 로그로 남긴다
  async deleteAccount(userId: number): Promise<{ ok: true }> {
    this.logger.warn(`계정 영구 삭제: user_id=${userId}`);
    const w = { where: { user_id: userId } };
    await this.prisma.$transaction([
      this.prisma.transaction.deleteMany(w),
      this.prisma.saving.deleteMany(w),
      this.prisma.investment.deleteMany(w),
      this.prisma.subscription.deleteMany(w),
      this.prisma.asset.deleteMany(w),
      this.prisma.netWorthSnapshot.deleteMany(w),
      this.prisma.userSettings.deleteMany(w),
      this.prisma.notification.deleteMany(w),
      this.prisma.task.deleteMany(w),
      this.prisma.goal.deleteMany(w),
      this.prisma.note.deleteMany(w),
      this.prisma.calendarEvent.deleteMany(w),
      this.prisma.securityRisk.deleteMany(w),
      this.prisma.loginSession.deleteMany(w),
      // category 는 전역 공용 — 특정 유저 삭제로 지우지 않음 (created_by 만 남고 데이터 보존)
      this.prisma.user.delete({ where: { id: userId } }),
    ]);
    return { ok: true };
  }
}
