import { Injectable, NotFoundException } from '@nestjs/common';
import { createHash } from 'crypto';
import { LoginSession } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CryptoService } from '@leejinyoun/core-security';
import { cipherContext } from '../crypto/crypto-fields';
import { AccessLogService } from '../access-log/access-log.service';
import type { ClientInfo } from '@leejinyoun/core-logging';

type RiskCategory = 'reuse' | 'weak' | 'no2fa' | 'breach';
type RiskSeverity = 'critical' | 'danger' | 'warning' | 'info';
export interface ComputedRisk {
  id: number;
  credentialId: number;
  category: RiskCategory;
  severity: RiskSeverity;
  title: string;
  description: string;
  actionLabel: string;
  href: string;
}

@Injectable()
export class SecurityService {
  constructor(
    private prisma: PrismaService,
    private crypto: CryptoService,
    private accessLog: AccessLogService,
  ) {}

  // 비밀번호 강도 점수(0~100) — 프론트 pwStrength 와 동일 로직
  private strength(pw: string): number {
    if (!pw) return 0;
    let s = 0;
    if (pw.length >= 8) s += 30;
    if (pw.length >= 12) s += 20;
    if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s += 20;
    if (/\d/.test(pw)) s += 15;
    if (/[^A-Za-z0-9]/.test(pw)) s += 15;
    return Math.min(s, 100);
  }

  // 계정 보관함 실시간 분석 — 재사용/취약/2FA미설정 위험 + 카테고리별 건수.
  // 비밀번호를 복호화해 동일값 그룹·강도를 계산한다(외부 유출검사 breach 는 미구현).
  private async analyze(userId: number): Promise<{ risks: ComputedRisk[]; counts: Record<RiskCategory, number> }> {
    const creds = await this.prisma.credential.findMany({
      where: { user_id: userId, deleted_at: null },
      orderBy: { id: 'asc' },
    });
    const decoded = creds.map((c) => ({
      id: c.id,
      name: c.name,
      pw: this.crypto.decrypt(c.password_enc, cipherContext('credential.password_enc', c.user_id)),
      has2fa: !!c.totp_enc,
    }));

    const byPw = new Map<string, number>();
    decoded.forEach((c) => byPw.set(c.pw, (byPw.get(c.pw) ?? 0) + 1));

    // 위험 항목 클릭 시 해당 계정으로 바로 이동하도록 credential id 를 쿼리로 딥링크
    const link = (id: number) => `/credentials?focus=${id}`;
    const risks: ComputedRisk[] = [];
    let seq = 1;
    for (const c of decoded) {
      if ((byPw.get(c.pw) ?? 0) > 1) {
        risks.push({ id: seq++, credentialId: c.id, category: 'reuse', severity: 'danger', title: `'${c.name}' 비밀번호 재사용`, description: '다른 계정과 동일한 비밀번호를 사용 중입니다.', actionLabel: '변경', href: link(c.id) });
      }
      if (c.pw.length < 8 || this.strength(c.pw) < 45) {
        risks.push({ id: seq++, credentialId: c.id, category: 'weak', severity: 'warning', title: `'${c.name}' 취약한 비밀번호`, description: '길이·복잡도가 부족합니다.', actionLabel: '강화', href: link(c.id) });
      }
      if (!c.has2fa) {
        risks.push({ id: seq++, credentialId: c.id, category: 'no2fa', severity: 'warning', title: `'${c.name}' 2FA 미설정`, description: '2단계 인증 설정을 권장합니다.', actionLabel: '설정', href: link(c.id) });
      }
    }
    const counts: Record<RiskCategory, number> = {
      reuse: risks.filter((r) => r.category === 'reuse').length,
      weak: risks.filter((r) => r.category === 'weak').length,
      no2fa: risks.filter((r) => r.category === 'no2fa').length,
      breach: 0,
    };
    return { risks, counts };
  }

  private sessionDto(s: LoginSession) {
    return {
      id: s.id,
      device: s.device,
      deviceType: s.device_type,
      location: s.location,
      isCurrent: s.is_current,
      status: s.status,
      lastActiveAt: s.last_active_at.toISOString(),
    };
  }

  // 카테고리별 건수 → 보안 점수(0~100). summary·snapshot 공용
  private scoreOf(counts: Record<RiskCategory, number>): number {
    const deduction = counts.reuse * 8 + counts.weak * 5 + counts.no2fa * 3;
    return Math.max(0, Math.min(100, 100 - deduction));
  }

  // 요약 — 실시간 분석 기반 보안 점수 + 카테고리별 건수
  async summary(userId: number) {
    const { risks, counts } = await this.analyze(userId);
    const score = this.scoreOf(counts);
    const label = score >= 80 ? '양호' : score >= 60 ? '보통' : '취약';
    return {
      score,
      scoreLabel: label,
      gainIfResolved: 100 - score,
      riskCount: risks.length,
      stats: counts,
    };
  }

  // 오늘(KST) 보안 점수 1건 적재 — 크론에서 매일 호출(같은 날 재호출 시 갱신)
  async snapshot(userId: number): Promise<void> {
    const { counts } = await this.analyze(userId);
    const score = this.scoreOf(counts);
    const date = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10); // KST 날짜
    await this.prisma.securityScoreSnapshot.upsert({
      where: { user_id_date: { user_id: userId, date } },
      create: { user_id: userId, date, score, reuse: counts.reuse, weak: counts.weak, no2fa: counts.no2fa },
      update: { score, reuse: counts.reuse, weak: counts.weak, no2fa: counts.no2fa },
    });
  }

  // 유출 비밀번호 검사 — HaveIBeenPwned Pwned Passwords(k-anonymity).
  // SHA-1 해시의 앞 5자만 외부로 보내고(원문/전체해시 노출 0), 나머지 35자는 로컬에서 대조한다.
  async breachCheck(userId: number) {
    const creds = await this.prisma.credential.findMany({
      where: { user_id: userId, deleted_at: null },
      select: { id: true, name: true, password_enc: true },
    });

    const prefixCache = new Map<string, Map<string, number>>(); // prefix → (suffix → 유출횟수)
    const results: { credentialId: number; name: string; count: number }[] = [];

    for (const c of creds) {
      const pw = this.crypto.decrypt(c.password_enc, cipherContext('credential.password_enc', userId));
      const sha1 = createHash('sha1').update(pw).digest('hex').toUpperCase();
      const prefix = sha1.slice(0, 5);
      const suffix = sha1.slice(5);

      let table = prefixCache.get(prefix);
      if (!table) {
        table = await this.fetchPwnedRange(prefix);
        prefixCache.set(prefix, table);
      }
      const count = table.get(suffix) ?? 0;
      if (count > 0) results.push({ credentialId: c.id, name: c.name, count });
    }

    results.sort((a, b) => b.count - a.count);
    return { checked: creds.length, breachedCount: results.length, items: results };
  }

  // HIBP range API 호출 → suffix→count 맵. 실패 시 빈 맵(검사 자체는 계속)
  private async fetchPwnedRange(prefix: string): Promise<Map<string, number>> {
    const table = new Map<string, number>();
    try {
      const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
        headers: { 'Add-Padding': 'true' }, // 응답 길이로 유추 못하도록 패딩 요청
      });
      if (!res.ok) return table;
      const text = await res.text();
      for (const line of text.split('\n')) {
        const [suf, cnt] = line.trim().split(':');
        if (suf) table.set(suf.toUpperCase(), Number(cnt) || 0);
      }
    } catch {
      // 네트워크 실패는 무시 — 해당 prefix 는 미검출로 처리
    }
    return table;
  }

  // 비밀번호 강도 분포 — 전 계정의 강도를 강함/보통/취약 3구간으로 집계 (프론트 pwStrength 와 동일 기준)
  async strengthStats(userId: number) {
    const creds = await this.prisma.credential.findMany({
      where: { user_id: userId, deleted_at: null },
      select: { password_enc: true },
    });
    let strong = 0, medium = 0, weak = 0;
    for (const c of creds) {
      const s = this.strength(this.crypto.decrypt(c.password_enc, cipherContext('credential.password_enc', userId)));
      if (s >= 75) strong++;
      else if (s >= 45) medium++;
      else weak++;
    }
    const total = creds.length;
    return { total, strong, medium, weak, avgScorePct: total ? Math.round(((strong * 100 + medium * 60 + weak * 25) / total)) : 0 };
  }

  // 보안 점수 추이 (최근 days 일, 오래된→최신순)
  async scoreTrend(userId: number, days = 30) {
    const rows = await this.prisma.securityScoreSnapshot.findMany({
      where: { user_id: userId },
      orderBy: { date: 'desc' },
      take: Math.min(Math.max(days, 1), 365),
    });
    return rows
      .reverse()
      .map((r) => ({ date: r.date, score: r.score, reuse: r.reuse, weak: r.weak, no2fa: r.no2fa }));
  }

  // 위험 요소 목록 (심각도순) — 실시간 분석 결과
  async risks(userId: number) {
    const order: RiskSeverity[] = ['critical', 'danger', 'warning', 'info'];
    const { risks } = await this.analyze(userId);
    return risks.sort((a, b) => order.indexOf(a.severity) - order.indexOf(b.severity));
  }

  // 활성 로그인 세션 목록 (현재 기기 먼저, 최근활동순)
  async sessions(userId: number) {
    const rows = await this.prisma.loginSession.findMany({
      where: { user_id: userId, revoked_at: null },
      orderBy: [{ is_current: 'desc' }, { last_active_at: 'desc' }],
    });
    return rows.map((s) => this.sessionDto(s));
  }

  // 단일 세션 로그아웃/차단 (현재 기기는 불가) — 연결된 refresh 토큰도 함께 폐기
  async revokeSession(userId: number, id: number, client?: ClientInfo) {
    const session = await this.prisma.loginSession.findFirst({
      where: { id, user_id: userId, revoked_at: null },
    });
    if (!session) throw new NotFoundException('세션을 찾을 수 없습니다.');
    if (session.is_current) throw new NotFoundException('현재 기기는 로그아웃할 수 없습니다.');
    await this.prisma.$transaction([
      this.prisma.loginSession.update({ where: { id }, data: { revoked_at: new Date() } }),
      this.prisma.refreshToken.updateMany({
        where: { session_id: id, revoked_at: null },
        data: { revoked_at: new Date() },
      }),
    ]);
    await this.accessLog.log(userId, 'session_revoke', { type: 'security', id, name: session.device }, client);
    return { id };
  }

  // 현재 기기 제외 전체 로그아웃 — 연결된 refresh 토큰도 함께 폐기
  async revokeAll(userId: number, client?: ClientInfo) {
    const sessions = await this.prisma.loginSession.findMany({
      where: { user_id: userId, revoked_at: null, is_current: false },
      select: { id: true },
    });
    const ids = sessions.map((s) => s.id);
    await this.prisma.$transaction([
      this.prisma.loginSession.updateMany({ where: { id: { in: ids } }, data: { revoked_at: new Date() } }),
      this.prisma.refreshToken.updateMany({
        where: { session_id: { in: ids }, revoked_at: null },
        data: { revoked_at: new Date() },
      }),
    ]);
    await this.accessLog.log(userId, 'session_revoke', { type: 'security', id: userId, name: `all:${ids.length}` }, client);
    return { revoked: ids.length };
  }
}
