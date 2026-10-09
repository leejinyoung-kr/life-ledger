import { createHash, randomInt, randomUUID } from 'node:crypto';
import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { User } from '@prisma/client';
import { env } from '../config/env.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { NotificationService } from '../notification/notification.service.js';
import { MailService } from '../mail/mail.service.js';
import { JWT_ALGORITHMS, JWT_AUDIENCE, JWT_ISSUER } from './jwt.constants.js';

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

// 토큰 수명 — Access 짧게(자주 갱신), Refresh 는 설정(session_expiry)에 따라 가변
const ACCESS_TTL = '15m';

// 설정의 session_expiry(7d|1d|12h|none) → refresh 토큰 만료. none은 사실상 무제한(10년)으로 처리
const SESSION_EXPIRY_MAP: Record<string, { jwt: string; ms: number }> = {
  '12h': { jwt: '12h', ms: 12 * 60 * 60 * 1000 },
  '1d': { jwt: '1d', ms: 24 * 60 * 60 * 1000 },
  '7d': { jwt: '7d', ms: 7 * 24 * 60 * 60 * 1000 },
  none: { jwt: '3650d', ms: 3650 * 24 * 60 * 60 * 1000 },
};
const DEFAULT_SESSION_EXPIRY = SESSION_EXPIRY_MAP['7d'];

// 이메일 로그인 코드 — 6자리, 5분 만료, 최대 5회 검증 시도
const EMAIL_CODE_TTL_MS = 5 * 60 * 1000;
const EMAIL_CODE_MAX_ATTEMPTS = 5;
// 이메일 단위 발급 상한 — 재발급으로 시도 횟수를 초기화하는 대입 공격을 IP 와 무관하게 하루 50회 추측 이하로 묶는다
const EMAIL_CODE_HOURLY_MAX = 5;
const EMAIL_CODE_DAILY_MAX = 10;
const HOUR_MS = 60 * 60 * 1000;
// 검증 실패 공통 문구 — 허용 여부·코드 유무·만료·횟수 초과를 구분하지 않아 허용 이메일 열거를 막는다
const EMAIL_CODE_INVALID = '인증코드가 올바르지 않거나 만료되었습니다. 다시 요청하세요.';

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
  // 로그인 허용 이메일 화이트리스트 (구글 전략과 동일 기준, 소문자) — env 가 1개 이상을 보장한다(비면 부팅 실패)
  private readonly allowedEmails = env.ALLOWED_EMAILS;
  // refresh 전용 시크릿 — access 와 분리해 refresh 토큰이 보호 API 에서 절대 검증되지 않게 한다
  private readonly refreshSecret = env.JWT_REFRESH_SECRET;

  constructor(
    private jwtService: JwtService,
    private prisma: PrismaService,
    private notification: NotificationService,
    private mail: MailService,
  ) {}

  // 이메일이 화이트리스트에 있는지 — 목록 밖이면 거부(fail-closed)
  private isEmailAllowed(email: string): boolean {
    return this.allowedEmails.includes(email.toLowerCase());
  }

  private hashCode(code: string): string {
    return createHash('sha256').update(code).digest('hex');
  }

  // 접근 토큰 — 사용자 정보 포함. JwtStrategy(core-auth)가 type·iss·aud 까지 검증한다
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
      { expiresIn: ACCESS_TTL, issuer: JWT_ISSUER, audience: JWT_AUDIENCE },
    );
  }

  // 갱신 토큰 — sub + jti(화이트리스트 식별자), httpOnly 쿠키로만 사용. refresh 전용 시크릿으로 서명
  // ttl은 SESSION_EXPIRY_MAP의 값(jsonwebtoken이 받는 시간 문자열)만 들어오므로 캐스팅이 안전함
  private signRefresh(userId: number, jti: string, ttl: string): string {
    return this.jwtService.sign(
      { sub: userId, jti, type: 'refresh' },
      { secret: this.refreshSecret, expiresIn: ttl as never },
    );
  }

  // 갱신 토큰 서명 검증 — refresh 전용 시크릿 + 알고리즘 고정. 실패 시 jsonwebtoken 에러를 그대로 던진다
  private verifyRefresh(token: string): {
    sub: number;
    jti?: string;
    type?: string;
  } {
    return this.jwtService.verify(token, {
      secret: this.refreshSecret,
      algorithms: JWT_ALGORITHMS,
    });
  }

  // 사용자의 세션 자동 만료 설정(session_expiry) 조회 — 미설정 시 기본 7일
  private async sessionExpiryOf(userId: number): Promise<{ jwt: string; ms: number }> {
    const settings = await this.prisma.userSettings.findUnique({
      where: { user_id: userId },
      select: { session_expiry: true },
    });
    return SESSION_EXPIRY_MAP[settings?.session_expiry ?? ''] ?? DEFAULT_SESSION_EXPIRY;
  }

  // 로컬 개발용 자동 로그인 — 고정 유저를 upsert 후 토큰 발급. NODE_ENV 가드는 컨트롤러에서 처리
  async devLogin(client?: LoginClient): Promise<{ access: string; refresh: string; refreshTtlMs: number }> {
    const email = 'dev@local';
    const user = await this.prisma.user.upsert({
      where: { email },
      update: {},
      create: { email, name: 'Dev User' },
    });
    return this.issueTokens(user, client);
  }

  // Google 로그인 시 user upsert 후 access/refresh 토큰 발급. 클라이언트 정보가 있으면 세션 기록·신규 기기 감지
  async login(googleUser: GoogleUser, client?: LoginClient): Promise<{ access: string; refresh: string; refreshTtlMs: number }> {
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
  private async issueTokens(user: User, client?: LoginClient): Promise<{ access: string; refresh: string; refreshTtlMs: number }> {
    const sessionId = client ? await this.recordLogin(user.id, client) : null;
    const jti = randomUUID();
    const { jwt: ttl, ms } = await this.sessionExpiryOf(user.id);
    await this.prisma.refreshToken.create({
      data: { user_id: user.id, session_id: sessionId, jti, expires_at: new Date(Date.now() + ms) },
    });
    return { access: this.signAccess(user), refresh: this.signRefresh(user.id, jti, ttl), refreshTtlMs: ms };
  }

  // 이메일 코드 발송 — 화이트리스트 통과 + 발급 상한 이내일 때 6자리 코드를 메일로 보낸다.
  // 이메일 허용 여부·상한 초과를 응답으로 노출하지 않음(열거 공격 차단) — 항상 동일 결과, 메일 발송은 기다리지 않는다
  async requestEmailCode(rawEmail: string, client?: LoginClient): Promise<{ ok: true }> {
    const email = rawEmail.trim().toLowerCase();

    // 허용 이메일만 실제 발송. 그 외엔 조용히 무시(응답은 동일)
    if (this.isEmailAllowed(email) && this.mail.isEnabled) {
      if (await this.emailCodeQuotaExceeded(email)) {
        this.logger.warn(`이메일 코드 발급 상한 초과 — 발송 생략 (to=${email})`);
        return { ok: true };
      }
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
      // 응답 시간으로 허용 이메일이 드러나지 않게 SMTP 발송은 기다리지 않는다
      void this.mail
        .sendLoginCode(email, code)
        .then((sent) => {
          if (!sent) this.logger.warn(`이메일 코드 발송 실패 (to=${email})`);
        })
        .catch((e: unknown) => this.logger.warn(`이메일 코드 발송 오류 (to=${email}): ${String(e)}`));
    } else if (!this.mail.isEnabled) {
      this.logger.warn('SMTP 비활성 — 이메일 코드 발송 불가');
    }

    return { ok: true };
  }

  // 이메일 단위 발급 상한(1시간·24시간) 초과 여부 — 무효화된 코드도 발급 횟수에 센다
  private async emailCodeQuotaExceeded(email: string): Promise<boolean> {
    const now = Date.now();
    const [hourly, daily] = await Promise.all([
      this.prisma.emailLoginCode.count({ where: { email, created_at: { gte: new Date(now - HOUR_MS) } } }),
      this.prisma.emailLoginCode.count({ where: { email, created_at: { gte: new Date(now - 24 * HOUR_MS) } } }),
    ]);
    return hourly >= EMAIL_CODE_HOURLY_MAX || daily >= EMAIL_CODE_DAILY_MAX;
  }

  // 이메일 코드 검증 → 성공 시 사용자 조회/생성 후 토큰 발급. 실패는 사유와 무관하게 같은 400 문구
  async verifyEmailCode(
    rawEmail: string,
    code: string,
    client?: LoginClient,
  ): Promise<{ access: string; refresh: string; refreshTtlMs: number }> {
    const email = rawEmail.trim().toLowerCase();
    const invalid = () => new BadRequestException(EMAIL_CODE_INVALID);
    if (!this.isEmailAllowed(email)) throw invalid();

    // 최신 미사용 코드 1건
    const record = await this.prisma.emailLoginCode.findFirst({
      where: { email, consumed_at: null },
      orderBy: { created_at: 'desc' },
    });
    if (!record) throw invalid();

    if (record.expires_at.getTime() < Date.now()) {
      await this.prisma.emailLoginCode.update({ where: { id: record.id }, data: { consumed_at: new Date() } });
      throw invalid();
    }

    // 시도 횟수를 조건부로 먼저 올린다 — 동시 요청이 와도 상한을 넘겨 비교하지 못한다(원자적)
    const counted = await this.prisma.emailLoginCode.updateMany({
      where: { id: record.id, consumed_at: null, attempts: { lt: EMAIL_CODE_MAX_ATTEMPTS } },
      data: { attempts: { increment: 1 } },
    });
    if (counted.count !== 1) {
      await this.prisma.emailLoginCode.updateMany({ where: { id: record.id, consumed_at: null }, data: { consumed_at: new Date() } });
      throw invalid();
    }

    if (record.code_hash !== this.hashCode(code.trim())) throw invalid();

    // 성공 — 코드를 조건부로 소비해 같은 코드로 동시에 두 번 로그인되지 않게 한다
    const consumed = await this.prisma.emailLoginCode.updateMany({
      where: { id: record.id, consumed_at: null },
      data: { consumed_at: new Date() },
    });
    if (consumed.count !== 1) throw invalid();
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

    // 기존 세션이 있던 사용자에게만 새 기기 알림 (최초 로그인은 제외).
    // 새 기기 로그인은 보안 이벤트 → 웹 푸시도 함께 적재한다(알림 저장과 같은 트랜잭션, 발송은 아웃박스)
    if (priorCount > 0) {
      await this.notification.createWithPush(
        userId,
        {
          group: 'system',
          tone: 'warning',
          title: '새 기기에서 로그인',
          description: `${device} (${location}) 에서 로그인되었습니다. 본인이 아니라면 보안 센터에서 세션을 로그아웃하세요.`,
          source: '보안',
        },
        { url: '/security', body: `${device} (${location}) 에서 로그인되었습니다.` },
      );
    }

    return created.id;
  }

  // 갱신 토큰 검증 → 화이트리스트 확인 후 rotation(이전 jti 폐기 + 신규 access/refresh 발급)
  async refresh(refreshToken: string): Promise<{ access: string; refresh: string; refreshTtlMs: number }> {
    if (!refreshToken) throw new UnauthorizedException('갱신 토큰이 없습니다.');
    let payload: { sub: number; jti?: string; type?: string };
    try {
      payload = this.verifyRefresh(refreshToken);
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
    const { jwt: ttl, ms } = await this.sessionExpiryOf(user.id);
    await this.prisma.$transaction([
      this.prisma.refreshToken.update({ where: { id: stored.id }, data: { revoked_at: new Date() } }),
      this.prisma.refreshToken.create({
        data: {
          user_id: user.id,
          session_id: stored.session_id,
          jti: newJti,
          expires_at: new Date(Date.now() + ms),
        },
      }),
    ]);

    return { access: this.signAccess(user), refresh: this.signRefresh(user.id, newJti, ttl), refreshTtlMs: ms };
  }

  // 로그아웃 — refresh 토큰의 jti 를 화이트리스트에서 폐기 (서명 검증 실패해도 디코드되면 폐기 시도)
  async logout(refreshToken?: string): Promise<void> {
    if (!refreshToken) return;
    let payload: { jti?: string } | null;
    try {
      payload = this.verifyRefresh(refreshToken);
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
      this.prisma.netWorthSnapshot.deleteMany(w),
      this.prisma.userSettings.deleteMany(w),
      this.prisma.notification.deleteMany(w),
      this.prisma.calendarEvent.deleteMany(w),
      this.prisma.securityRisk.deleteMany(w),
      this.prisma.loginSession.deleteMany(w),
      // category 는 전역 공용 — 특정 유저 삭제로 지우지 않음 (created_by 만 남고 데이터 보존)
      this.prisma.user.delete({ where: { id: userId } }),
    ]);
    return { ok: true };
  }
}
