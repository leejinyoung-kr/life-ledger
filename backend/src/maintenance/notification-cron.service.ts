import { Injectable } from '@nestjs/common';
import { Job } from '@leejinyoung-kr/core-jobs';
import { NotiGroup, NotiTone } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { todayKst } from '../common/kst-date';
import { NotificationService } from '../notification/notification.service';

// 오늘(KST 날짜의 UTC 자정) + days 후 Date
function addDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

@Injectable()
export class NotificationCronService {
  constructor(
    private prisma: PrismaService,
    private notification: NotificationService,
  ) {}

  // 매일 오전 9시 — 전 사용자 대상 임박/초과 알림 생성
  @Job({ name: 'notification-daily', cron: '0 9 * * *', leaseMs: 10 * 60_000 })
  async generateDaily(): Promise<string> {
    const users = await this.prisma.user.findMany({ select: { id: true } });
    let created = 0;
    for (const u of users) created += await this.runForUser(u.id);
    return `알림 ${created}건 생성 (사용자 ${users.length}명)`;
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
    // 알림 저장과 같은 트랜잭션에 웹 푸시를 적재한다 — 저장이 롤백되면 푸시도 나가지 않는다.
    // 발송은 아웃박스가 맡는다(실패 시 재시도, VAPID 비활성이면 적재하지 않음). 민감정보 없이 제목/설명만
    await this.notification.createWithPush(userId, n);
    return 1;
  }

  // 한 사용자의 알림 후보를 생성 (예적금만기·구독결제/체험·신원만료·비번회전)
  private async runForUser(userId: number): Promise<number> {
    const today = todayKst();
    let n = 0;

    const settings = await this.prisma.userSettings.findUnique({ where: { user_id: userId } });

    // 만기/결제 임박 알림(예적금·구독) — settings.notif_maturity 켜진 경우만
    if (settings?.notif_maturity ?? true) {
      // 2) 예적금 만기 D-30 / D-14 / D-7 / D-1 (매일 반복되지 않도록 정확히 해당 일자에만 발생)
      const maturityReminderDays = [30, 14, 7, 1];
      const savings = await this.prisma.saving.findMany({
        where: { user_id: userId, deleted_at: null, maturity_date: { in: maturityReminderDays.map((d) => addDays(today, d)) } },
      });
      for (const s of savings) {
        const daysLeft = maturityReminderDays.find((d) => addDays(today, d).getTime() === new Date(s.maturity_date!).getTime()) ?? 0;
        n += await this.emit(userId, {
          group: 'ledger', tone: 'warning',
          title: `${s.name} 만기 임박`, description: `예적금 만기가 ${daysLeft}일 남았습니다.`, source: '예적금',
        });
      }

      // 2-1) ISA 등 투자 계좌 만기 D-30 / D-14 / D-7 / D-1
      const isaAccounts = await this.prisma.investmentAccount.findMany({
        where: { user_id: userId, deleted_at: null, maturity_date: { in: maturityReminderDays.map((d) => addDays(today, d)) } },
      });
      for (const a of isaAccounts) {
        const daysLeft = maturityReminderDays.find((d) => addDays(today, d).getTime() === new Date(a.maturity_date!).getTime()) ?? 0;
        n += await this.emit(userId, {
          group: 'ledger', tone: 'warning',
          title: `${a.name} 만기 임박`, description: `투자 계좌 만기가 ${daysLeft}일 남았습니다.`, source: '투자',
        });
      }

      // 3) 구독 결제 D-1 / D-3 / D-7, 무료체험 종료 D-1 / D-3 / D-7 (매일 반복되지 않도록 정확히 해당 일자에만 발생)
      const reminderDays = [1, 3, 7];
      const subs = await this.prisma.subscription.findMany({
        where: { user_id: userId, deleted_at: null, next_payment_date: { in: reminderDays.map((d) => addDays(today, d)) } },
      });
      for (const s of subs) {
        const trial = s.status === 'trial';
        const daysLeft = reminderDays.find((d) => addDays(today, d).getTime() === new Date(s.next_payment_date).getTime()) ?? 0;
        n += await this.emit(userId, {
          group: 'ledger', tone: trial ? 'warning' : 'info',
          title: trial ? `${s.name} 무료체험 종료 임박` : `${s.name} 결제 예정`,
          description: trial ? `무료체험이 ${daysLeft}일 후 종료되어 과금됩니다.` : `구독 결제일이 ${daysLeft}일 남았습니다.`,
          source: '구독',
        });
      }
    }

    // 만료/마감 임박 알림(신원·할일) — settings.notif_deadline 켜진 경우만
    if (settings?.notif_deadline ?? true) {
      // 4) 신원 문서 만료 D-60 / D-30 / D-14 / D-7 / D-1 (매일 반복되지 않도록 정확히 해당 일자에만 발생)
      const expireReminderDays = [60, 30, 14, 7, 1];
      const ids = await this.prisma.identityCard.findMany({
        where: { user_id: userId, deleted_at: null, expire_date: { in: expireReminderDays.map((d) => addDays(today, d)) } },
      });
      for (const i of ids) {
        const daysLeft = expireReminderDays.find((d) => addDays(today, d).getTime() === new Date(i.expire_date!).getTime()) ?? 0;
        n += await this.emit(userId, {
          group: 'system', tone: 'warning',
          title: `${i.name} 문서 만료 임박`, description: `신원 문서 유효기간이 ${daysLeft}일 남았습니다.`, source: '신원 지갑',
        });
      }
    }

    // 6) 비밀번호 회전 — 마지막 변경 90일 경과 시 알림, 이후 30일 간격으로 재알림 (매일 반복 방지)
    const MS_PER_DAY = 24 * 60 * 60 * 1000;
    const rotateBefore = addDays(today, -90);
    const stale = await this.prisma.credential.findMany({
      where: { user_id: userId, deleted_at: null, password_changed_at: { lt: rotateBefore } },
      select: { name: true, password_changed_at: true },
    });
    for (const c of stale) {
      const changedAt = c.password_changed_at!;
      const changedDay = new Date(Date.UTC(changedAt.getUTCFullYear(), changedAt.getUTCMonth(), changedAt.getUTCDate()));
      const daysStale = Math.round((today.getTime() - changedDay.getTime()) / MS_PER_DAY);
      if (daysStale === 90 || (daysStale > 90 && (daysStale - 90) % 30 === 0)) {
        n += await this.emit(userId, {
          group: 'system', tone: 'warning',
          title: `'${c.name}' 비밀번호 교체 권장`, description: `비밀번호를 변경한 지 ${daysStale}일이 지났습니다.`, source: '계정 보관함',
        });
      }
    }

    return n;
  }
}
