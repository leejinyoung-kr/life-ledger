import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InvestmentAccount, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { parsePage } from '../common/pagination';
import { CreateInvestmentAccountDto } from './dto/create-investment-account.dto';
import { QueryInvestmentAccountDto } from './dto/query-investment-account.dto';
import { UpdateInvestmentAccountDto } from './dto/update-investment-account.dto';

type HoldingsAgg = { count: number; principal: number; currentValue: number };

@Injectable()
export class InvestmentAccountService {
  constructor(private prisma: PrismaService) {}

  // 엔티티 → 응답 DTO. 보유종목 집계(개수·원금합·평가금합)는 호출부에서 병합해 전달
  private toDto(a: InvestmentAccount, agg?: HoldingsAgg) {
    return {
      id: a.id,
      name: a.name,
      cashBalance: a.cash_balance.toNumber(),
      memo: a.memo,
      holdingsCount: agg?.count ?? 0,
      totalPrincipal: agg?.principal ?? 0,
      totalCurrentValue: agg?.currentValue ?? 0,
    };
  }

  // 계좌별 보유종목 집계(개수·원금합·평가금합) 일괄 조회 — 계좌 목록 응답에 병합
  private async aggregateHoldings(userId: number, accountIds: number[]): Promise<Map<number, HoldingsAgg>> {
    const map = new Map<number, HoldingsAgg>();
    if (!accountIds.length) return map;
    const rows = await this.prisma.investment.findMany({
      where: { user_id: userId, account_id: { in: accountIds }, deleted_at: null },
      select: { account_id: true, principal: true, current_value: true },
    });
    for (const r of rows) {
      const cur = map.get(r.account_id) ?? { count: 0, principal: 0, currentValue: 0 };
      cur.count += 1;
      cur.principal += r.principal.toNumber();
      cur.currentValue += r.current_value.toNumber();
      map.set(r.account_id, cur);
    }
    return map;
  }

  // 계좌 목록 — 계좌명 검색. page 지정 시 서버 페이징, 없으면 전체 배열
  async findAll(userId: number, query: QueryInvestmentAccountDto = {}) {
    const where: Prisma.InvestmentAccountWhereInput = { user_id: userId, deleted_at: null };
    if (query.q) where.name = { contains: query.q };
    const orderBy: Prisma.InvestmentAccountOrderByWithRelationInput = { created_at: 'desc' };

    const pg = parsePage(query.page, query.limit);
    if (pg) {
      const [rows, total] = await this.prisma.$transaction([
        this.prisma.investmentAccount.findMany({ where, orderBy, skip: pg.skip, take: pg.take }),
        this.prisma.investmentAccount.count({ where }),
      ]);
      const agg = await this.aggregateHoldings(userId, rows.map((r) => r.id));
      return { items: rows.map((r) => this.toDto(r, agg.get(r.id))), total, page: pg.page, limit: pg.limit };
    }

    const rows = await this.prisma.investmentAccount.findMany({ where, orderBy });
    const agg = await this.aggregateHoldings(userId, rows.map((r) => r.id));
    return rows.map((r) => this.toDto(r, agg.get(r.id)));
  }

  // 요약 — 총 예수금 / 계좌 수
  async summary(userId: number) {
    const rows = await this.prisma.investmentAccount.findMany({ where: { user_id: userId, deleted_at: null } });
    return {
      totalCash: rows.reduce((s, r) => s + r.cash_balance.toNumber(), 0),
      accountCount: rows.length,
    };
  }

  // 계좌 추가
  async create(userId: number, dto: CreateInvestmentAccountDto) {
    const created = await this.prisma.investmentAccount.create({
      data: {
        user_id: userId,
        name: dto.name,
        cash_balance: new Prisma.Decimal(dto.cashBalance ?? 0),
        memo: dto.memo,
      },
    });
    return this.toDto(created);
  }

  // 본인 소유 + 미삭제 확인
  private async findOwned(userId: number, id: number): Promise<InvestmentAccount> {
    const row = await this.prisma.investmentAccount.findFirst({
      where: { id, user_id: userId, deleted_at: null },
    });
    if (!row) throw new NotFoundException('투자 계좌를 찾을 수 없습니다.');
    return row;
  }

  // 계좌 수정
  async update(userId: number, id: number, dto: UpdateInvestmentAccountDto) {
    await this.findOwned(userId, id);
    const updated = await this.prisma.investmentAccount.update({
      where: { id },
      data: {
        name: dto.name,
        cash_balance: dto.cashBalance !== undefined ? new Prisma.Decimal(dto.cashBalance) : undefined,
        memo: dto.memo,
      },
    });
    return this.toDto(updated);
  }

  // 계좌 삭제 (soft delete) — 보유 종목이 남아있으면 차단(고아 종목 방지)
  async remove(userId: number, id: number) {
    await this.findOwned(userId, id);
    const holdings = await this.prisma.investment.count({ where: { account_id: id, deleted_at: null } });
    if (holdings > 0) throw new BadRequestException('보유 종목이 남아있는 계좌는 삭제할 수 없습니다.');
    await this.prisma.investmentAccount.update({ where: { id }, data: { deleted_at: new Date() } });
    return { id };
  }
}
