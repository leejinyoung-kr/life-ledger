import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Subscription, SubscriptionCycle } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { UpdateSubscriptionDto } from './dto/update-subscription.dto';

// Date → 'YYYY-MM-DD' (@db.Date 는 시각 정보 없음)
function toDateStr(d: Date | null): string | null {
  return d ? d.toISOString().slice(0, 10) : null;
}

// 주기별 청구액을 월 기준으로 환산 (연→/12, 주→*52/12)
function toMonthly(amount: number, cycle: SubscriptionCycle): number {
  if (cycle === 'yearly') return amount / 12;
  if (cycle === 'weekly') return (amount * 52) / 12;
  return amount;
}

// 자정 기준 두 날짜 사이 경과 일수 (과거일수록 양수)
function daysSince(d: Date): number {
  const ms = Date.now() - d.getTime();
  return Math.floor(ms / (24 * 60 * 60 * 1000));
}

@Injectable()
export class SubscriptionService {
  constructor(private prisma: PrismaService) {}

  // 엔티티 → 응답 DTO (Decimal→number, Date→문자열)
  private toDto(s: Subscription) {
    return {
      id: s.id,
      name: s.name,
      category: s.category,
      amount: s.amount.toNumber(),
      cycle: s.cycle,
      status: s.status,
      nextPaymentDate: toDateStr(s.next_payment_date),
      payMethod: s.pay_method,
      lastUsedAt: toDateStr(s.last_used_at),
      memo: s.memo,
    };
  }

  // 구독 목록 (해지=soft delete 제외)
  async findAll(userId: number) {
    const rows = await this.prisma.subscription.findMany({
      where: { user_id: userId, deleted_at: null },
      orderBy: { created_at: 'desc' },
    });
    return rows.map((r) => this.toDto(r));
  }

  // 요약 — 월 구독료 합계 / 연 환산 / 활성 구독 수 / 다음 결제까지(최소 D-day + 서비스명)
  async summary(userId: number) {
    const rows = await this.prisma.subscription.findMany({
      where: { user_id: userId, deleted_at: null },
    });

    // 일시정지(paused)는 비용·카운트에서 제외 (활성 + 체험만 집계)
    const billing = rows.filter((r) => r.status !== 'paused');
    const monthlyTotal = Math.round(
      billing.reduce((sum, r) => sum + toMonthly(r.amount.toNumber(), r.cycle), 0),
    );

    // 다음 결제 임박 — 오늘 이후 가장 가까운 결제일
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const upcoming = billing
      .filter((r) => r.next_payment_date >= today)
      .sort((a, b) => a.next_payment_date.getTime() - b.next_payment_date.getTime())[0];
    const nextDays = upcoming
      ? Math.ceil((upcoming.next_payment_date.getTime() - today.getTime()) / (24 * 60 * 60 * 1000))
      : null;

    return {
      monthlyTotal,
      yearlyTotal: monthlyTotal * 12,
      activeCount: billing.length,
      nextPayment: upcoming ? { days: nextDays, name: upcoming.name } : null,
    };
  }

  // 미사용 의심 구독 — 마지막 사용 30일 초과 OR 미사용(체험 등). 비용 큰 순
  async unused(userId: number) {
    const rows = await this.prisma.subscription.findMany({
      where: { user_id: userId, deleted_at: null, status: { not: 'paused' } },
    });
    return rows
      .filter((r) => !r.last_used_at || daysSince(r.last_used_at) > 30)
      .map((r) => ({
        id: r.id,
        name: r.name,
        category: r.category,
        status: r.status,
        monthlyCost: Math.round(toMonthly(r.amount.toNumber(), r.cycle)),
        lastUsedAt: toDateStr(r.last_used_at),
        daysSince: r.last_used_at ? daysSince(r.last_used_at) : null,
      }))
      .sort((a, b) => b.monthlyCost - a.monthlyCost);
  }

  // 구독 추가
  async create(userId: number, dto: CreateSubscriptionDto) {
    const created = await this.prisma.subscription.create({
      data: {
        user_id: userId,
        name: dto.name,
        category: dto.category,
        amount: new Prisma.Decimal(dto.amount),
        cycle: dto.cycle,
        status: dto.status ?? 'active',
        next_payment_date: new Date(dto.nextPaymentDate),
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

  // 구독 수정
  async update(userId: number, id: number, dto: UpdateSubscriptionDto) {
    await this.findOwned(userId, id);
    const updated = await this.prisma.subscription.update({
      where: { id },
      data: {
        name: dto.name,
        category: dto.category,
        amount: dto.amount !== undefined ? new Prisma.Decimal(dto.amount) : undefined,
        cycle: dto.cycle,
        status: dto.status,
        next_payment_date: dto.nextPaymentDate ? new Date(dto.nextPaymentDate) : undefined,
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
