import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Saving } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { parsePage } from '@leejinyoung-kr/core-common';
import { CreateSavingDto } from './dto/create-saving.dto';
import { QuerySavingDto } from './dto/query-saving.dto';
import { UpdateSavingDto } from './dto/update-saving.dto';

// Date → 'YYYY-MM-DD'
function toDateStr(d: Date | null): string | null {
  return d ? d.toISOString().slice(0, 10) : null;
}

@Injectable()
export class SavingService {
  constructor(private prisma: PrismaService) {}

  // 엔티티 → 응답 DTO
  private toDto(s: Saving) {
    return {
      id: s.id,
      bank: s.bank,
      name: s.name,
      type: s.type,
      interestRate: s.interest_rate.toNumber(),
      monthlyAmount: s.monthly_amount.toNumber(),
      startDate: toDateStr(s.start_date),
      maturityDate: toDateStr(s.maturity_date),
      balance: s.balance.toNumber(),
      memo: s.memo,
    };
  }

  // 예적금 목록 — 유형/상품명 필터. page 지정 시 서버 페이징, 없으면 전체 배열
  async findAll(userId: number, query: QuerySavingDto = {}) {
    const where: Prisma.SavingWhereInput = { user_id: userId, deleted_at: null };
    if (query.type) where.type = query.type;
    if (query.q) where.name = { contains: query.q };
    const orderBy: Prisma.SavingOrderByWithRelationInput = { id: 'desc' };

    const pg = parsePage(query.page, query.limit);
    if (pg) {
      const [rows, total] = await this.prisma.$transaction([
        this.prisma.saving.findMany({ where, orderBy, skip: pg.skip, take: pg.take }),
        this.prisma.saving.count({ where }),
      ]);
      return { items: rows.map((r) => this.toDto(r)), total, page: pg.page, limit: pg.limit };
    }

    const rows = await this.prisma.saving.findMany({ where, orderBy });
    return rows.map((r) => this.toDto(r));
  }

  // 요약 — 총 잔액 / 이번 달 납입(월 납입액 합) / 평균 금리 / 만기 임박(D-30) 건수
  async summary(userId: number) {
    const rows = await this.prisma.saving.findMany({
      where: { user_id: userId, deleted_at: null },
    });
    const totalBalance = rows.reduce((s, r) => s + r.balance.toNumber(), 0);
    const monthlyDeposit = rows.reduce((s, r) => s + r.monthly_amount.toNumber(), 0);
    const avgRate = rows.length
      ? rows.reduce((s, r) => s + r.interest_rate.toNumber(), 0) / rows.length
      : 0;

    // 만기 임박: 오늘 ~ 30일 이내 만기
    const now = new Date();
    const in30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const maturityNear = rows.filter(
      (r) => r.maturity_date && r.maturity_date >= now && r.maturity_date <= in30,
    ).length;

    return {
      totalBalance,
      monthlyDeposit,
      avgRate: Math.round(avgRate * 100) / 100,
      maturityNear,
    };
  }

  // 예적금 추가
  async create(userId: number, dto: CreateSavingDto) {
    const created = await this.prisma.saving.create({
      data: {
        user_id: userId,
        bank: dto.bank,
        name: dto.name,
        type: dto.type,
        interest_rate: new Prisma.Decimal(dto.interestRate ?? 0),
        monthly_amount: new Prisma.Decimal(dto.monthlyAmount ?? 0),
        start_date: new Date(dto.startDate),
        maturity_date: dto.maturityDate ? new Date(dto.maturityDate) : null,
        balance: new Prisma.Decimal(dto.balance ?? 0),
        memo: dto.memo,
      },
    });
    return this.toDto(created);
  }

  // 본인 소유 + 미삭제 확인
  private async findOwned(userId: number, id: number): Promise<Saving> {
    const row = await this.prisma.saving.findFirst({
      where: { id, user_id: userId, deleted_at: null },
    });
    if (!row) throw new NotFoundException('예적금을 찾을 수 없습니다.');
    return row;
  }

  // 예적금 수정
  async update(userId: number, id: number, dto: UpdateSavingDto) {
    await this.findOwned(userId, id);
    const updated = await this.prisma.saving.update({
      where: { id },
      data: {
        bank: dto.bank,
        name: dto.name,
        type: dto.type,
        interest_rate:
          dto.interestRate !== undefined ? new Prisma.Decimal(dto.interestRate) : undefined,
        monthly_amount:
          dto.monthlyAmount !== undefined ? new Prisma.Decimal(dto.monthlyAmount) : undefined,
        start_date: dto.startDate ? new Date(dto.startDate) : undefined,
        maturity_date: dto.maturityDate ? new Date(dto.maturityDate) : undefined,
        balance: dto.balance !== undefined ? new Prisma.Decimal(dto.balance) : undefined,
        memo: dto.memo,
      },
    });
    return this.toDto(updated);
  }

  // 예적금 삭제 (soft delete)
  async remove(userId: number, id: number) {
    await this.findOwned(userId, id);
    await this.prisma.saving.update({
      where: { id },
      data: { deleted_at: new Date() },
    });
    return { id };
  }

  // 예적금 일괄 삭제 (soft delete)
  async removeMany(userId: number, ids: number[]) {
    if (!ids.length) throw new BadRequestException('삭제할 항목이 없습니다.');
    const { count } = await this.prisma.saving.updateMany({
      where: { id: { in: ids }, user_id: userId, deleted_at: null },
      data: { deleted_at: new Date() },
    });
    return { count };
  }
}
