import { Injectable } from '@nestjs/common';
import { Job } from '@leejinyoung-kr/core-jobs';
import { PrismaService } from '../prisma/prisma.service';
import { rollForward } from '../subscription/billing-date.util';
import { todayKst } from '../common/kst-date';

@Injectable()
export class SubscriptionCronService {
  constructor(private prisma: PrismaService) {}

  // 매일 0시 5분 — 결제일이 지난 구독을 주기만큼 넘긴다(월/연은 원래 결제일 billing_day 기준). 체험은 종료일이 지나면 유료 전환으로 보고 활성으로 바꾼다.
  // 일시정지는 결제가 없으니 그대로 둔다. 오전 9시 결제 알림(D-7/3/1)보다 먼저 돌아야 다음 회차 알림이 맞는다
  @Job({ name: 'subscription-roll-forward', cron: '5 0 * * *', leaseMs: 5 * 60_000 })
  async rollForwardPastDue(): Promise<string> {
    const today = todayKst();
    const rows = await this.prisma.subscription.findMany({
      where: { deleted_at: null, status: { not: 'paused' }, next_payment_date: { lt: today } },
      select: { id: true, cycle: true, status: true, next_payment_date: true, billing_day: true },
    });
    for (const r of rows) {
      await this.prisma.subscription.update({
        where: { id: r.id },
        data: {
          next_payment_date: rollForward(r.next_payment_date, r.cycle, r.billing_day, today),
          ...(r.status === 'trial' ? { status: 'active' as const } : {}),
        },
      });
    }
    return `구독 결제일 ${rows.length}건 갱신`;
  }
}
