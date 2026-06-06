import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Investment, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateInvestmentDto } from './dto/create-investment.dto';
import { UpdateInvestmentDto } from './dto/update-investment.dto';

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
      profit,
      profitRate: principal ? Math.round((profit / principal) * 1000) / 10 : 0,
      purchaseDate: v.purchase_date ? v.purchase_date.toISOString().slice(0, 10) : null,
      memo: v.memo,
    };
  }

  // 투자 목록
  async findAll(userId: number) {
    const rows = await this.prisma.investment.findMany({
      where: { user_id: userId, deleted_at: null },
      orderBy: { created_at: 'desc' },
    });
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
