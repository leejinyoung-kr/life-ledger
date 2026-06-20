import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Investment, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { parsePage } from '../common/pagination';
import { CreateInvestmentDto } from './dto/create-investment.dto';
import { QueryInvestmentDto } from './dto/query-investment.dto';
import { UpdateInvestmentDto } from './dto/update-investment.dto';
import { TradeInvestmentDto } from './dto/trade-investment.dto';

@Injectable()
export class InvestmentService {
  constructor(private prisma: PrismaService) {}

  // 엔티티 → 응답 DTO (수익/수익률 파생값 포함)
  private toDto(v: Investment) {
    const principal = v.principal.toNumber();
    const currentValue = v.current_value.toNumber();
    const profit = currentValue - principal;
    return {
      id: v.id,
      name: v.name,
      type: v.type,
      principal,
      currentValue,
      cashBalance: v.cash_balance.toNumber(),
      profit,
      profitRate: principal ? Math.round((profit / principal) * 1000) / 10 : 0,
      purchaseDate: v.purchase_date ? v.purchase_date.toISOString().slice(0, 10) : null,
      memo: v.memo,
    };
  }

  // 투자 목록 — 유형/종목명 필터. page 지정 시 서버 페이징, 없으면 전체 배열
  async findAll(userId: number, query: QueryInvestmentDto = {}) {
    const where: Prisma.InvestmentWhereInput = { user_id: userId, deleted_at: null };
    if (query.type) where.type = query.type;
    if (query.q) where.name = { contains: query.q };
    const orderBy: Prisma.InvestmentOrderByWithRelationInput = { created_at: 'desc' };

    const pg = parsePage(query.page, query.limit);
    if (pg) {
      const [rows, total] = await this.prisma.$transaction([
        this.prisma.investment.findMany({ where, orderBy, skip: pg.skip, take: pg.take }),
        this.prisma.investment.count({ where }),
      ]);
      return { items: rows.map((r) => this.toDto(r)), total, page: pg.page, limit: pg.limit };
    }

    const rows = await this.prisma.investment.findMany({ where, orderBy });
    return rows.map((r) => this.toDto(r));
  }

  // 요약 — 총 평가금액 / 총 원금 / 총 수익 / 수익률
  async summary(userId: number) {
    const rows = await this.prisma.investment.findMany({
      where: { user_id: userId, deleted_at: null },
    });
    const totalValue = rows.reduce((s, r) => s + r.current_value.toNumber(), 0);
    const totalPrincipal = rows.reduce((s, r) => s + r.principal.toNumber(), 0);
    const totalProfit = totalValue - totalPrincipal;
    return {
      totalValue,
      totalPrincipal,
      totalProfit,
      profitRate: totalPrincipal ? Math.round((totalProfit / totalPrincipal) * 1000) / 10 : 0,
    };
  }

  // 투자 추가
  async create(userId: number, dto: CreateInvestmentDto) {
    const created = await this.prisma.investment.create({
      data: {
        user_id: userId,
        name: dto.name,
        type: dto.type,
        principal: new Prisma.Decimal(dto.principal),
        current_value: new Prisma.Decimal(dto.currentValue),
        purchase_date: dto.purchaseDate ? new Date(dto.purchaseDate) : null,
        memo: dto.memo,
      },
    });
    return this.toDto(created);
  }

  // 본인 소유 + 미삭제 확인
  private async findOwned(userId: number, id: number): Promise<Investment> {
    const row = await this.prisma.investment.findFirst({
      where: { id, user_id: userId, deleted_at: null },
    });
    if (!row) throw new NotFoundException('투자 항목을 찾을 수 없습니다.');
    return row;
  }

  // 투자 수정
  async update(userId: number, id: number, dto: UpdateInvestmentDto) {
    await this.findOwned(userId, id);
    const updated = await this.prisma.investment.update({
      where: { id },
      data: {
        name: dto.name,
        type: dto.type,
        principal: dto.principal !== undefined ? new Prisma.Decimal(dto.principal) : undefined,
        current_value:
          dto.currentValue !== undefined ? new Prisma.Decimal(dto.currentValue) : undefined,
        purchase_date: dto.purchaseDate ? new Date(dto.purchaseDate) : undefined,
        memo: dto.memo,
      },
    });
    return this.toDto(updated);
  }

  // 매수 — 예수금을 깎아 투자원금·평가금액에 동반 반영(증권사 예수금→매수 흐름과 동일)
  async buy(userId: number, id: number, dto: TradeInvestmentDto) {
    const row = await this.findOwned(userId, id);
    const amount = new Prisma.Decimal(dto.amount);
    if (row.cash_balance.lessThan(amount)) {
      throw new BadRequestException('예수금이 부족합니다.');
    }
    const updated = await this.prisma.investment.update({
      where: { id },
      data: {
        cash_balance: { decrement: amount },
        principal: { increment: amount },
        current_value: { increment: amount },
      },
    });
    return this.toDto(updated);
  }

  // 매도 — 평가금액을 줄이고 예수금으로 환입(원금은 누적 투입 기준으로 유지)
  async sell(userId: number, id: number, dto: TradeInvestmentDto) {
    const row = await this.findOwned(userId, id);
    const amount = new Prisma.Decimal(dto.amount);
    if (row.current_value.lessThan(amount)) {
      throw new BadRequestException('평가금액이 부족합니다.');
    }
    const updated = await this.prisma.investment.update({
      where: { id },
      data: {
        current_value: { decrement: amount },
        cash_balance: { increment: amount },
      },
    });
    return this.toDto(updated);
  }

  // 투자 삭제 (soft delete)
  async remove(userId: number, id: number) {
    await this.findOwned(userId, id);
    await this.prisma.investment.update({
      where: { id },
      data: { deleted_at: new Date() },
    });
    return { id };
  }

  // 투자 일괄 삭제 (soft delete)
  async removeMany(userId: number, ids: number[]) {
    if (!ids.length) throw new BadRequestException('삭제할 항목이 없습니다.');
    const { count } = await this.prisma.investment.updateMany({
      where: { id: { in: ids }, user_id: userId, deleted_at: null },
      data: { deleted_at: new Date() },
    });
    return { count };
  }
}
