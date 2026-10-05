import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Subscription, SubscriptionCurrency, SubscriptionCycle } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PriceLookupService } from '../investment/price-lookup.service';
import { parsePage } from '@leejinyoung-kr/core-common';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { QuerySubscriptionDto } from './dto/query-subscription.dto';
import { UpdateSubscriptionDto } from './dto/update-subscription.dto';
import { todayKst } from '../common/kst-date';

// Date → 'YYYY-MM-DD' (@db.Date 는 시각 정보 없음)
function toDateStr(d: Date | null): string | null {
  return d ? d.toISOString().slice(0, 10) : null;
}

// 주기별 청구액을 월 기준으로 환산 (연→/12, 주→*52/12). USD면 rate로 원화 환산 후 계산
function toMonthly(amount: number, cycle: SubscriptionCycle, currency: SubscriptionCurrency, usdToKrwRate: number): number {
  const krwAmount = currency === 'USD' ? amount * usdToKrwRate : amount;
  if (cycle === 'yearly') return krwAmount / 12;
  if (cycle === 'weekly') return (krwAmount * 52) / 12;
  return krwAmount;
}

@Injectable()
export class SubscriptionService {
  constructor(
    private prisma: PrismaService,
    private priceLookup: PriceLookupService,
  ) {}

  // 엔티티 → 응답 DTO (Decimal→number, Date→문자열)
  private toDto(s: Subscription) {
    return {
      id: s.id,
      name: s.name,
      category: s.category,
      amount: s.amount.toNumber(),
      currency: s.currency,
      cycle: s.cycle,
      status: s.status,
      nextPaymentDate: toDateStr(s.next_payment_date),
      payMethod: s.pay_method,
      lastUsedAt: toDateStr(s.last_used_at),
      memo: s.memo,
    };
  }

  // 구독 목록 (해지=soft delete 제외) — 서비스명/카테고리 검색.
  // page 지정 시 서버 페이징, 없으면 전체 배열.
  async findAll(userId: number, query: QuerySubscriptionDto = {}) {
    const where: Prisma.SubscriptionWhereInput = { user_id: userId, deleted_at: null };
    if (query.q) {
      where.OR = [
        { name: { contains: query.q } },
        { category: { contains: query.q } },
      ];
    }
    const orderBy: Prisma.SubscriptionOrderByWithRelationInput = { created_at: 'desc' };

    const pg = parsePage(query.page, query.limit);
    if (pg) {
      const [rows, total] = await this.prisma.$transaction([
        this.prisma.subscription.findMany({ where, orderBy, skip: pg.skip, take: pg.take }),
        this.prisma.subscription.count({ where }),
      ]);
      return { items: rows.map((r) => this.toDto(r)), total, page: pg.page, limit: pg.limit };
    }

    const rows = await this.prisma.subscription.findMany({ where, orderBy });
    return rows.map((r) => this.toDto(r));
  }

  // 요약 — 월 구독료 합계 / 연 환산 / 활성 구독 수 / 다음 결제까지(최소 D-day + 서비스명)
  async summary(userId: number) {
    const rows = await this.prisma.subscription.findMany({
      where: { user_id: userId, deleted_at: null },
    });

    // 일시정지(paused)는 비용·카운트에서 제외 (활성 + 체험만 집계)
    const billing = rows.filter((r) => r.status !== 'paused');

    // USD 구독이 하나라도 있을 때만 환율 조회 (행마다 호출하지 않고 1회만 재사용)
    const hasUsd = billing.some((r) => r.currency === 'USD');
    const usdToKrwRate = hasUsd ? await this.priceLookup.getExchangeRate('USD', 'KRW') : 1;

    const monthlyTotal = Math.round(
      billing.reduce((sum, r) => sum + toMonthly(r.amount.toNumber(), r.cycle, r.currency, usdToKrwRate), 0),
    );

    // 다음 결제 임박 — 오늘(KST) 이후 가장 가까운 결제일
    const today = todayKst();
    const upcoming = billing
      .filter((r) => r.next_payment_date >= today)
      .sort((a, b) => a.next_payment_date.getTime() - b.next_payment_date.getTime())[0];
    const nextDays = upcoming
      ? Math.ceil((upcoming.next_payment_date.getTime() - today.getTime()) / (24 * 60 * 60 * 1000))
      : null;

    // 체험 종료 임박 배너용 — 첫 체험 구독 (목록이 페이징되어도 배너가 동작하도록 요약에 동봉)
    const trialRow = rows.find((r) => r.status === 'trial');
    const trial = trialRow
      ? {
          id: trialRow.id,
          name: trialRow.name,
          amount: trialRow.amount.toNumber(),
          cycle: trialRow.cycle,
          nextPaymentDate: toDateStr(trialRow.next_payment_date),
        }
      : null;

    return {
      monthlyTotal,
      yearlyTotal: monthlyTotal * 12,
      activeCount: billing.length,
      nextPayment: upcoming ? { days: nextDays, name: upcoming.name } : null,
      trial,
    };
  }

  // 구독 추가
  async create(userId: number, dto: CreateSubscriptionDto) {
    const created = await this.prisma.subscription.create({
      data: {
        user_id: userId,
        name: dto.name,
        category: dto.category,
        amount: new Prisma.Decimal(dto.amount),
        currency: dto.currency ?? 'KRW',
        cycle: dto.cycle,
        status: dto.status ?? 'active',
        next_payment_date: new Date(dto.nextPaymentDate),
        billing_day: new Date(dto.nextPaymentDate).getUTCDate(),
        pay_method: dto.payMethod,
        last_used_at: dto.lastUsedAt ? new Date(dto.lastUsedAt) : null,
        memo: dto.memo,
      },
    });
    return this.toDto(created);
  }

  // 본인 소유 + 미해지 확인 후 반환
  private async findOwned(userId: number, id: number): Promise<Subscription> {
    const row = await this.prisma.subscription.findFirst({
      where: { id, user_id: userId, deleted_at: null },
    });
    if (!row) throw new NotFoundException('구독을 찾을 수 없습니다.');
    return row;
  }

  // 구독 수정 — 결제일을 바꾼 경우에만 원래 결제일(billing_day)도 새 날짜로 맞춘다
  // (수정 폼은 결제일을 늘 함께 보내므로, 말일로 줄어든 날짜를 그대로 보냈을 때 원래 결제일을 잃지 않게)
  async update(userId: number, id: number, dto: UpdateSubscriptionDto) {
    const current = await this.findOwned(userId, id);
    const nextDate = dto.nextPaymentDate ? new Date(dto.nextPaymentDate) : undefined;
    const dateChanged = nextDate !== undefined && nextDate.getTime() !== current.next_payment_date.getTime();
    const updated = await this.prisma.subscription.update({
      where: { id },
      data: {
        name: dto.name,
        category: dto.category,
        amount: dto.amount !== undefined ? new Prisma.Decimal(dto.amount) : undefined,
        currency: dto.currency,
        cycle: dto.cycle,
        status: dto.status,
        next_payment_date: nextDate,
        billing_day: nextDate && dateChanged ? nextDate.getUTCDate() : undefined,
        pay_method: dto.payMethod,
        last_used_at: dto.lastUsedAt ? new Date(dto.lastUsedAt) : undefined,
        memo: dto.memo,
      },
    });
    return this.toDto(updated);
  }

  // 구독 해지 (soft delete — deleted_at 기록)
  async remove(userId: number, id: number) {
    await this.findOwned(userId, id);
    await this.prisma.subscription.update({
      where: { id },
      data: { deleted_at: new Date() },
    });
    return { id };
  }
}
