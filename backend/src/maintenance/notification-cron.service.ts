import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { NotiGroup, NotiTone } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PushService } from '../push/push.service';

// 오늘(UTC 자정) + days 후 Date
function addDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

@Injectable()
export class NotificationCronService {
  private readonly logger = new Logger(NotificationCronService.name);

  constructor(
    private prisma: PrismaService,
    private push: PushService,
  ) {}

  // 매일 오전 9시 — 전 사용자 대상 임박/초과 알림 생성
  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async generateDaily(): Promise<void> {
    const users = await this.prisma.user.findMany({ select: { id: true } });
    let created = 0;
    for (const u of users) created += await this.runForUser(u.id);
    if (created) this.logger.log(`알림 ${created}건 생성 (사용자 ${users.length}명)`);
  }

  // 동일 제목의 미읽음 알림이 있으면 건너뛰고, 없으면 생성 (중복 방지)
  private async emit(
    userId: number,
    n: { group: NotiGroup; tone: NotiTone; title: string; description: string; source: string },
  ): Promise<number> {
    const dup = await this.prisma.notification.findFirst({
      where: { user_id: userId, title: n.title, read_at: null },
      select: { id: true },
    });
    if (dup) return 0;
    await this.prisma.notification.create({ data: { user_id: userId, ...n } });
    // 앱 내 알림 생성과 동시에 웹 푸시 발송 (VAPID 비활성 시 no-op). 민감정보 없이 제목/설명만
    await this.push.sendToUser(userId, { title: n.title, body: n.description, url: '/notifications' });
    return 1;
  }

  // 한 사용자의 알림 후보를 생성 (예적금만기·구독결제/체험·신원만료·비번회전)
  private async runForUser(userId: number): Promise<number> {
    const now = new Date();
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    let n = 0;

    const settings = await this.prisma.userSettings.findUnique({ where: { user_id: userId } });

    // 만기/결제 임박 알림(예적금·구독) — settings.notif_maturity 켜진 경우만
    if (settings?.notif_maturity ?? true) {
      // 2) 예적금 만기 D-30
      const savings = await this.prisma.saving.findMany({
        where: { user_id: userId, deleted_at: null, maturity_date: { gte: today, lte: addDays(today, 30) } },
      });
      for (const s of savings) {
        n += await this.emit(userId, {
          group: 'ledger', tone: 'warning',
          title: `${s.name} 만기 임박`, description: '예적금 만기가 30일 이내입니다.', source: '예적금',
        });
      }

      // 2-1) ISA 등 투자 계좌 만기 D-30
      const isaAccounts = await this.prisma.investmentAccount.findMany({
        where: { user_id: userId, deleted_at: null, maturity_date: { gte: today, lte: addDays(today, 30) } },
      });
      for (const a of isaAccounts) {
        n += await this.emit(userId, {
          group: 'ledger', tone: 'warning',
          title: `${a.name} 만기 임박`, description: '투자 계좌 만기가 30일 이내입니다.', source: '투자',
        });
      }

      // 3) 구독 결제 D-3 / 무료체험 종료 D-3
      const subs = await this.prisma.subscription.findMany({
        where: { user_id: userId, deleted_at: null, next_payment_date: { gte: today, lte: addDays(today, 3) } },
      });
      for (const s of subs) {
        const trial = s.status === 'trial';
        n += await this.emit(userId, {
          group: 'ledger', tone: trial ? 'warning' : 'info',
          title: trial ? `${s.name} 무료체험 종료 임박` : `${s.name} 결제 예정`,
          description: trial ? '무료체험이 3일 내 종료되어 과금됩니다.' : '구독 결제일이 3일 이내입니다.',
          source: '구독',
        });
      }
    }

    // 만료/마감 임박 알림(신원·할일) — settings.notif_deadline 켜진 경우만
    if (settings?.notif_deadline ?? true) {
      // 4) 신원 문서 만료 D-60
      const ids = await this.prisma.identityCard.findMany({
        where: { user_id: userId, deleted_at: null, expire_date: { gte: today, lte: addDays(today, 60) } },
      });
      for (const i of ids) {
        n += await this.emit(userId, {
          group: 'system', tone: 'warning',
          title: `${i.name} 문서 만료 임박`, description: '신원 문서 유효기간이 60일 이내입니다.', source: '신원 지갑',
        });
      }
    }

    // 6) 비밀번호 회전 — 마지막 변경 90일 경과 계정
    const rotateBefore = addDays(today, -90);
    const stale = await this.prisma.credential.findMany({
      where: { user_id: userId, deleted_at: null, password_changed_at: { lt: rotateBefore } },
      select: { name: true },
    });
    for (const c of stale) {
      n += await this.emit(userId, {
        group: 'system', tone: 'warning',
        title: `'${c.name}' 비밀번호 교체 권장`, description: '비밀번호를 변경한 지 90일이 지났습니다.', source: '계정 보관함',
      });
    }

    return n;
  }
}
