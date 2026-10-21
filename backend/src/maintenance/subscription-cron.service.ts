import { Injectable } from '@nestjs/common';
import { Prisma, Subscription } from '@prisma/client';
import { Job } from '@leejinyoung-kr/core-jobs';
import { PrismaService } from '../prisma/prisma.service';
import { PriceLookupService } from '../investment/price-lookup.service';
import { pastBillingDates } from '../subscription/billing-date.util';
import { kstDateStr, todayKst } from '../common/kst-date';

// 구독 자동 등록 내역의 가계부 카테고리 — 가계부 소분류 「구독·정기결제」
const LEDGER_CATEGORY = 'insurance_subscription';

type DueRow = Pick<Subscription, 'id' | 'user_id' | 'name' | 'amount' | 'currency' | 'pay_method' | 'auto_ledger' | 'cycle' | 'status' | 'next_payment_date' | 'billing_day' | 'created_at'>;

@Injectable()
export class SubscriptionCronService {
  constructor(
    private prisma: PrismaService,
    private priceLookup: PriceLookupService,
  ) {}

  // 매일 0시 5분 — 결제일이 지난 구독을 주기만큼 넘긴다(월/연은 원래 결제일 billing_day 기준). 체험은 종료일이 지나면 유료 전환으로 보고 활성으로 바꾼다.
  // 가계부 자동 등록이 켜져 있으면 지나간 결제일마다 지출 내역을 같이 만든다 — 결제가 그날 밤에 될 수도 있어 당일이 아니라 다음 날 넣는다.
  // 일시정지는 결제가 없으니 그대로 둔다. 오전 9시 결제 알림(D-7/3/1)보다 먼저 돌아야 다음 회차 알림이 맞는다
  @Job({ name: 'subscription-roll-forward', cron: '5 0 * * *', leaseMs: 5 * 60_000 })
  async rollForwardPastDue(): Promise<string> {
    const today = todayKst();
    const rows = await this.prisma.subscription.findMany({
      where: { deleted_at: null, status: { not: 'paused' }, next_payment_date: { lt: today } },
      select: {
        id: true, user_id: true, name: true, amount: true, currency: true, pay_method: true, auto_ledger: true,
        cycle: true, status: true, next_payment_date: true, billing_day: true, created_at: true,
      },
    });

    // 환율은 넣을 USD 구독이 있을 때만 한 번 조회. 실패하면 그 구독은 결제일도 넘기지 않고 다음 날 다시 한다(내역을 빠뜨리지 않게)
    const needsRate = rows.some((r) => r.auto_ledger && r.currency === 'USD');
    const usdRate = needsRate ? await this.priceLookup.getExchangeRate('USD', 'KRW').catch(() => null) : null;

    let rolled = 0;
    let added = 0;
    let deferred = 0;
    for (const r of rows) {
      if (r.auto_ledger && r.currency === 'USD' && usdRate === null) {
        deferred += 1;
        continue;
      }
      const { past, next } = pastBillingDates(r.next_payment_date, r.cycle, r.billing_day, today);
      // 구독을 등록하기 전 결제일은 이미 손으로 넣었을 수 있어 만들지 않는다
      const since = kstDateStr(r.created_at);
      const dates = r.auto_ledger ? past.filter((d) => d.toISOString().slice(0, 10) >= since) : [];

      await this.prisma.$transaction(async (tx) => {
        if (dates.length) {
          // 지운 내역까지 포함해 이미 만든 결제일은 건너뛴다 — 결제 실패로 지운 내역이 다시 생기지 않게
          const made = await tx.transaction.findMany({
            where: { subscription_id: r.id, date: { in: dates } },
            select: { date: true },
          });
          const have = new Set(made.map((m) => m.date.getTime()));
          const data = dates.filter((d) => !have.has(d.getTime())).map((d) => this.ledgerRow(r, d, usdRate));
          if (data.length) {
            await tx.transaction.createMany({ data });
            added += data.length;
          }
        }
        await tx.subscription.update({
          where: { id: r.id },
          data: {
            next_payment_date: next,
            ...(r.status === 'trial' ? { status: 'active' as const } : {}),
          },
        });
      });
      rolled += 1;
    }

    const summary = `구독 결제일 ${rolled}건 갱신 · 가계부 ${added}건 추가`;
    if (deferred) throw new Error(`${summary} — 환율 조회 실패로 USD 구독 ${deferred}건은 내일 다시`);
    return summary;
  }

  // 결제일 하루치 가계부 지출 행 — USD 는 원화로 바꾸고 원래 금액 · 환율을 메모에 남긴다
  private ledgerRow(r: DueRow, date: Date, usdRate: number | null): Prisma.TransactionCreateManyInput {
    const isUsd = r.currency === 'USD';
    const amount = isUsd ? new Prisma.Decimal(Math.round(r.amount.toNumber() * usdRate!)) : r.amount;
    return {
      user_id: r.user_id,
      type: 'expense',
      date,
      title: r.name,
      category: LEDGER_CATEGORY,
      amount,
      pay_method: r.pay_method,
      memo: isUsd ? `USD ${r.amount.toNumber()} × ${usdRate!.toLocaleString('ko-KR', { maximumFractionDigits: 2 })}원` : null,
      subscription_id: r.id,
    };
  }
}
