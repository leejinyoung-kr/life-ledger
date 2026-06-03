import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Transaction, TransactionType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { QueryTransactionDto } from './dto/query-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';

// Date → 'YYYY-MM-DD' (UTC 기준, @db.Date 는 시각 정보 없음)
function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// 'YYYY-MM' → 해당 월 [시작, 다음달 시작) 범위
function monthRange(month: string): { gte: Date; lt: Date } {
  const [y, m] = month.split('-').map(Number);
  const gte = new Date(Date.UTC(y, m - 1, 1));
  const lt = new Date(Date.UTC(y, m, 1));
  return { gte, lt };
}

@Injectable()
export class TransactionService {
  constructor(private prisma: PrismaService) {}

  // 엔티티 → 프론트 응답 DTO (Decimal→number, Date→문자열)
  private toDto(t: Transaction) {
    return {
      id: t.id,
      type: t.type,
      date: toDateStr(t.date),
      title: t.title,
      category: t.category,
      amount: t.amount.toNumber(),
      payMethod: t.pay_method,
      memo: t.memo,
      isRecurring: t.is_recurring,
      recurringRule: t.recurring_rule ?? null,
    };
  }

  // 사용자의 가장 최근 거래 월(YYYY-MM). 없으면 null — 더미 데이터(과거)에서도 추이가 보이도록 기준점 사용
  private async latestMonth(userId: number): Promise<string | null> {
    const latest = await this.prisma.transaction.findFirst({
      where: { user_id: userId, deleted_at: null },
      orderBy: { date: 'desc' },
      select: { date: true },
    });
    return latest ? toDateStr(latest.date).slice(0, 7) : null;
  }

  // 내역 목록 — 날짜범위/유형/카테고리/검색어 필터
  async findAll(userId: number, query: QueryTransactionDto) {
    const where: Prisma.TransactionWhereInput = {
      user_id: userId,
      deleted_at: null,
    };
    if (query.from || query.to) {
      where.date = {
        ...(query.from ? { gte: new Date(query.from) } : {}),
        ...(query.to   ? { lte: new Date(query.to)   } : {}),
      };
    }
    if (query.type) where.type = query.type;
    if (query.category) where.category = query.category;
    if (query.q) where.title = { contains: query.q };

    const rows = await this.prisma.transaction.findMany({
      where,
      orderBy: [{ date: 'desc' }, { id: 'desc' }],
    });
    return rows.map((r) => this.toDto(r));
  }

  // 월 요약 — 수입/지출/저축이동 합계 + 실소비/잔액. month 미지정 시 최근 월 사용
  async summary(userId: number, month?: string) {
    const target = month ?? (await this.latestMonth(userId));
    const where: Prisma.TransactionWhereInput = {
      user_id: userId,
      deleted_at: null,
    };
    if (target) where.date = monthRange(target);

    const grouped = await this.prisma.transaction.groupBy({
      by: ['type'],
      where,
      _sum: { amount: true },
    });
    const sumOf = (type: TransactionType) =>
      grouped.find((g) => g.type === type)?._sum.amount?.toNumber() ?? 0;

    const income = sumOf('income');
    const expense = sumOf('expense');
    const transfer = sumOf('transfer');
    // 저축이동은 실소비가 아닌 자산 이동 → 잔액에서 함께 차감하되 실소비에는 미포함
    return {
      month: target,
      income,
      expense,
      transfer,
      realSpend: expense,
      balance: income - expense - transfer,
    };
  }

  // 월별 지출 추이 — 기준 월 포함 최근 5개월의 지출 합계
  async monthlyTrend(userId: number, month?: string) {
    const anchor = month ?? (await this.latestMonth(userId));
    if (!anchor) return [];
    const [y, m] = anchor.split('-').map(Number);

    const buckets: { month: string; label: string; total: number }[] = [];
    for (let i = 4; i >= 0; i--) {
      const d = new Date(Date.UTC(y, m - 1 - i, 1));
      const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
      const range = monthRange(key);
      const agg = await this.prisma.transaction.aggregate({
        where: {
          user_id: userId,
          deleted_at: null,
          type: 'expense',
          date: range,
        },
        _sum: { amount: true },
      });
      buckets.push({
        month: key,
        label: `${d.getUTCMonth() + 1}월`,
        total: agg._sum.amount?.toNumber() ?? 0,
      });
    }
    return buckets;
  }

  // 반복 거래 목록 — 동일한 규칙(제목·카테고리·유형·금액)은 한 번만 표시
  async recurring(userId: number) {
    const rows = await this.prisma.transaction.findMany({
      where: { user_id: userId, deleted_at: null, is_recurring: true },
      orderBy: { date: 'desc' },
    });

    const seen = new Set<string>();
    const unique = rows.filter((r) => {
      const key = `${r.title}|${r.category}|${r.type}|${r.amount}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    return unique.map((r) => this.toDto(r));
  }

  // 내역 추가
  async create(userId: number, dto: CreateTransactionDto) {
    const created = await this.prisma.transaction.create({
      data: {
        user_id: userId,
        type: dto.type,
        date: new Date(dto.date),
        title: dto.title,
        category: dto.category,
        amount: new Prisma.Decimal(dto.amount),
        pay_method: dto.payMethod,
        memo: dto.memo,
        is_recurring: dto.isRecurring ?? false,
        recurring_rule: dto.isRecurring && dto.recurringRule ? (dto.recurringRule as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
      },
    });
    return this.toDto(created);
  }

  // 본인 소유 + 미삭제 내역인지 확인 후 반환
  private async findOwned(userId: number, id: number): Promise<Transaction> {
    const row = await this.prisma.transaction.findFirst({
      where: { id, user_id: userId, deleted_at: null },
    });
    if (!row) throw new NotFoundException('거래 내역을 찾을 수 없습니다.');
    return row;
  }

  // 내역 수정
  async update(userId: number, id: number, dto: UpdateTransactionDto) {
    await this.findOwned(userId, id);
    const updated = await this.prisma.transaction.update({
      where: { id },
      data: {
        type: dto.type,
        date: dto.date ? new Date(dto.date) : undefined,
        title: dto.title,
        category: dto.category,
        amount: dto.amount !== undefined ? new Prisma.Decimal(dto.amount) : undefined,
        pay_method: dto.payMethod,
        memo: dto.memo,
        is_recurring: dto.isRecurring,
        recurring_rule: dto.isRecurring !== undefined
          ? (dto.isRecurring && dto.recurringRule ? (dto.recurringRule as unknown as Prisma.InputJsonValue) : Prisma.JsonNull)
          : undefined,
      },
    });
    return this.toDto(updated);
  }

  // 내역 삭제 (soft delete — deleted_at 기록)
  async remove(userId: number, id: number) {
    await this.findOwned(userId, id);
    await this.prisma.transaction.update({
      where: { id },
      data: { deleted_at: new Date() },
    });
    return { id };
  }
}
