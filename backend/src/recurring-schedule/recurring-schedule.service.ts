import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, RecurringSchedule } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { nthOccurrence, periodOf, type RRule } from '../transaction/recurring.util';
import { CreateRecurringScheduleDto } from './dto/create-recurring-schedule.dto';
import { QueryRecurringScheduleDto } from './dto/query-recurring-schedule.dto';
import { UpdateRecurringScheduleDto } from './dto/update-recurring-schedule.dto';

type ScheduleWithInvestment = RecurringSchedule & {
  investment: { id: number; name: string; symbol: string | null } | null;
};

@Injectable()
export class RecurringScheduleService {
  constructor(private prisma: PrismaService) {}

  // 엔티티 → 프론트 응답 DTO. nextRunDate는 rule 기준으로 계산해 목록에 "다음 실행일" 표시용으로 내려준다
  private toDto(s: ScheduleWithInvestment) {
    const rule = s.rule as unknown as RRule;
    let nextRunDate: string | null = null;
    if (s.active && rule?.cycle) {
      for (let i = 0; i <= 120; i++) {
        const occ = nthOccurrence(s.start_date, rule, i);
        if (occ < s.start_date) continue;
        const period = periodOf(occ, rule.cycle);
        if (!s.last_period || period > s.last_period) {
          nextRunDate = occ.toISOString().slice(0, 10);
          break;
        }
      }
    }
    return {
      id: s.id,
      kind: s.kind,
      rule: s.rule,
      startDate: s.start_date.toISOString().slice(0, 10),
      lastPeriod: s.last_period,
      active: s.active,
      nextRunDate,
      txType: s.tx_type,
      title: s.title,
      category: s.category,
      amount: s.amount ? s.amount.toNumber() : null,
      payMethod: s.pay_method,
      memo: s.memo,
      targetType: s.target_type,
      targetId: s.target_id,
      investmentId: s.investment_id,
      investmentName: s.investment?.name ?? null,
      investmentSymbol: s.investment?.symbol ?? null,
      buyAmount: s.buy_amount ? s.buy_amount.toNumber() : null,
      buyQuantity: s.buy_quantity ? s.buy_quantity.toNumber() : null,
    };
  }

  // 본인 소유 + 미삭제 투자 종목인지 확인 — kind=investment 스케줄이 참조하는 대상
  private async findOwnedInvestment(userId: number, investmentId: number) {
    const inv = await this.prisma.investment.findFirst({
      where: { id: investmentId, user_id: userId, deleted_at: null },
    });
    if (!inv) throw new BadRequestException('대상 투자 종목을 찾을 수 없습니다.');
    return inv;
  }

  // kind별 필수 조합 검증 — DTO의 ValidateIf만으로는 상호배타(금액/수량) 등을 표현할 수 없어 여기서 보강
  private validate(dto: { kind?: string; rule?: Record<string, unknown>; buyAmount?: number; buyQuantity?: number }) {
    if (!dto.rule?.cycle) throw new BadRequestException('반복 규칙(주기)이 필요합니다.');
    if (dto.kind === 'investment' && !dto.buyAmount && !dto.buyQuantity) {
      throw new BadRequestException('회차당 매수금액 또는 매수수량 중 하나를 입력해야 합니다.');
    }
  }

  // 자동이체 설정 목록 — kind 지정 시 해당 종류만
  async findAll(userId: number, query: QueryRecurringScheduleDto) {
    const rows = await this.prisma.recurringSchedule.findMany({
      where: { user_id: userId, deleted_at: null, kind: query.kind },
      orderBy: { created_at: 'desc' },
      include: { investment: { select: { id: true, name: true, symbol: true } } },
    });
    return rows.map((r) => this.toDto(r));
  }

  // 자동이체 설정 추가 — 데이터(거래/투자)는 등록 시점에 생성하지 않고, 크론이 규칙에 따라 순수 생성만 한다
  async create(userId: number, dto: CreateRecurringScheduleDto) {
    this.validate(dto);
    if (dto.kind === 'investment') await this.findOwnedInvestment(userId, dto.investmentId!);
    const hasTarget = dto.targetType != null && dto.targetId != null;

    const created = await this.prisma.recurringSchedule.create({
      data: {
        user_id: userId,
        kind: dto.kind,
        rule: dto.rule as Prisma.InputJsonValue,
        start_date: new Date(dto.startDate),
        active: dto.active ?? true,
        tx_type: dto.kind === 'transaction' ? dto.txType : null,
        title: dto.kind === 'transaction' ? dto.title : null,
        category: dto.kind === 'transaction' ? dto.category : null,
        amount: dto.kind === 'transaction' && dto.amount !== undefined ? new Prisma.Decimal(dto.amount) : null,
        pay_method: dto.kind === 'transaction' ? (dto.payMethod ?? '') : null,
        memo: dto.kind === 'transaction' ? dto.memo : null,
        target_type: dto.kind === 'transaction' && hasTarget ? dto.targetType : null,
        target_id: dto.kind === 'transaction' && hasTarget ? dto.targetId : null,
        investment_id: dto.kind === 'investment' ? dto.investmentId : null,
        buy_amount: dto.kind === 'investment' && dto.buyAmount !== undefined ? new Prisma.Decimal(dto.buyAmount) : null,
        buy_quantity: dto.kind === 'investment' && dto.buyQuantity !== undefined ? new Prisma.Decimal(dto.buyQuantity) : null,
      },
      include: { investment: { select: { id: true, name: true, symbol: true } } },
    });
    return this.toDto(created);
  }

  // 본인 소유 + 미삭제 확인
  private async findOwned(userId: number, id: number): Promise<RecurringSchedule> {
    const row = await this.prisma.recurringSchedule.findFirst({
      where: { id, user_id: userId, deleted_at: null },
    });
    if (!row) throw new NotFoundException('자동이체 설정을 찾을 수 없습니다.');
    return row;
  }

  // 자동이체 설정 수정
  async update(userId: number, id: number, dto: UpdateRecurringScheduleDto) {
    const existing = await this.findOwned(userId, id);
    const kind = dto.kind ?? existing.kind;
    if (dto.rule || dto.kind || dto.buyAmount !== undefined || dto.buyQuantity !== undefined) {
      this.validate({
        kind,
        rule: (dto.rule ?? existing.rule) as Record<string, unknown>,
        buyAmount: dto.buyAmount,
        buyQuantity: dto.buyQuantity !== undefined ? dto.buyQuantity : existing.buy_quantity?.toNumber(),
      });
    }
    if (dto.investmentId !== undefined) await this.findOwnedInvestment(userId, dto.investmentId);
    const hasTarget = dto.targetType !== undefined && dto.targetId !== undefined;

    const updated = await this.prisma.recurringSchedule.update({
      where: { id },
      data: {
        rule: dto.rule !== undefined ? (dto.rule as Prisma.InputJsonValue) : undefined,
        start_date: dto.startDate ? new Date(dto.startDate) : undefined,
        active: dto.active,
        tx_type: kind === 'transaction' ? dto.txType : undefined,
        title: kind === 'transaction' ? dto.title : undefined,
        category: kind === 'transaction' ? dto.category : undefined,
        amount: kind === 'transaction' && dto.amount !== undefined ? new Prisma.Decimal(dto.amount) : undefined,
        pay_method: kind === 'transaction' ? dto.payMethod : undefined,
        memo: kind === 'transaction' ? dto.memo : undefined,
        target_type: hasTarget ? dto.targetType : undefined,
        target_id: hasTarget ? dto.targetId : undefined,
        buy_amount: dto.buyAmount !== undefined ? new Prisma.Decimal(dto.buyAmount) : undefined,
        buy_quantity: dto.buyQuantity !== undefined ? new Prisma.Decimal(dto.buyQuantity) : undefined,
      },
      include: { investment: { select: { id: true, name: true, symbol: true } } },
    });
    return this.toDto(updated);
  }

  // 활성/일시정지 토글
  async toggle(userId: number, id: number) {
    const existing = await this.findOwned(userId, id);
    const updated = await this.prisma.recurringSchedule.update({
      where: { id },
      data: { active: !existing.active },
      include: { investment: { select: { id: true, name: true, symbol: true } } },
    });
    return this.toDto(updated);
  }

  // 삭제 (soft delete) — 이미 생성된 회차(거래/투자 반영분)는 그대로 유지, 향후 생성만 중단
  async remove(userId: number, id: number) {
    await this.findOwned(userId, id);
    await this.prisma.recurringSchedule.update({
      where: { id },
      data: { deleted_at: new Date() },
    });
    return { id };
  }
}
