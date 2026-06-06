import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpsertBudgetsDto } from './dto/upsert-budgets.dto';

export interface BudgetStatus {
  category: string;
  label: string;
  budget: number;       // 적용 예산 (오버라이드 or 기본값 + 이월)
  defaultBudget: number;
  carriedOver: number;
  spent: number;
  remaining: number;
  percent: number;
  isOver: boolean;
  isOverridden: boolean;
}

export interface BudgetSummary {
  totalBudget: number;
  totalCarriedOver: number;
  totalSpent: number;
  totalRemaining: number;
  overCount: number;
}

// 카테고리 코드 → 한글 라벨
const CATEGORY_LABEL: Record<string, string> = {
  food: '식비',
  transport: '교통',
  subscription: '구독',
  shopping: '쇼핑',
  etc: '기타',
};

@Injectable()
export class BudgetService {
  constructor(private readonly prisma: PrismaService) {}

  // 해당 월 예산 현황 (기본값 + 오버라이드 + 이월 + 실제 지출 비교)
  async getMonthStatus(userId: number, month: string): Promise<{ summary: BudgetSummary; categories: BudgetStatus[] }> {
    const [year, mon] = month.split('-').map(Number);
    const gte = new Date(Date.UTC(year, mon - 1, 1));
    const lt = new Date(Date.UTC(year, mon, 1));

    const [settings, overrides, txGroups] = await Promise.all([
      this.prisma.userSettings.findUnique({ where: { user_id: userId }, select: { budgets: true } }),
      this.prisma.monthlyBudget.findMany({ where: { user_id: userId, year_month: month } }),
      this.prisma.transaction.groupBy({
        by: ['category'],
        where: { user_id: userId, type: 'expense', deleted_at: null, date: { gte, lt } },
        _sum: { amount: true },
      }),
    ]);

    const defaultBudgets = (settings?.budgets as Record<string, number> | null) ?? {};
    const overrideMap = new Map(overrides.map((o) => [o.category, o]));
    const spentMap = new Map<string, number>(txGroups.map((g) => [g.category, Number(g._sum.amount ?? 0)]));

    // 기본 예산 카테고리 + 오버라이드 전용 카테고리 합산
    const allCategories = new Set([...Object.keys(defaultBudgets), ...overrides.map((o) => o.category)]);

    const categories: BudgetStatus[] = [...allCategories].map((cat) => {
      const defaultAmt = defaultBudgets[cat] ?? 0;
      const override = overrideMap.get(cat);
      const carriedOver = override?.carried_over_amount ?? 0;
      const overriddenAmt = override ? override.amount : null;
      const baseBudget = overriddenAmt !== null ? overriddenAmt : defaultAmt;
      const totalBudget = baseBudget + carriedOver;
      const spent = spentMap.get(cat) ?? 0;
      const remaining = totalBudget - spent;
      const percent = totalBudget > 0 ? Math.round((spent / totalBudget) * 100) : 0;

      return {
        category: cat,
        label: CATEGORY_LABEL[cat] ?? cat,
        budget: totalBudget,
        defaultBudget: defaultAmt,
        carriedOver,
        spent,
        remaining,
        percent,
        isOver: spent > totalBudget,
        isOverridden: overriddenAmt !== null,
      };
    });

    const totalBudget = categories.reduce((s, c) => s + c.budget, 0);
    const totalCarriedOver = categories.reduce((s, c) => s + c.carriedOver, 0);
    const totalSpent = categories.reduce((s, c) => s + c.spent, 0);

    return {
      summary: {
        totalBudget,
        totalCarriedOver,
        totalSpent,
        totalRemaining: totalBudget - totalSpent,
        overCount: categories.filter((c) => c.isOver).length,
      },
      categories,
    };
  }

  // 최근 6개월 예산 vs 실제 지출 히스토리
  async getHistory(userId: number) {
    const now = new Date();
    const history: { month: string; budgeted: number; spent: number; carriedOver: number }[] = [];

    for (let i = 5; i >= 0; i--) {
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
      const mo = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
      const { summary } = await this.getMonthStatus(userId, mo);
      history.push({ month: mo, budgeted: summary.totalBudget, spent: summary.totalSpent, carriedOver: summary.totalCarriedOver });
    }

    return history;
  }

  // 특정 달 예산 오버라이드 일괄 저장 (amount=0 이고 이월도 없으면 레코드 삭제)
  async upsertBudgets(userId: number, dto: UpsertBudgetsDto) {
    const { month, items } = dto;

    for (const item of items) {
      if (item.amount === 0) {
        const existing = await this.prisma.monthlyBudget.findUnique({
          where: { user_id_year_month_category: { user_id: userId, year_month: month, category: item.category } },
        });
        if (existing && existing.carried_over_amount > 0) {
          await this.prisma.monthlyBudget.update({
            where: { id: existing.id },
            data: { amount: 0 },
          });
        } else {
          await this.prisma.monthlyBudget.deleteMany({
            where: { user_id: userId, year_month: month, category: item.category },
          });
        }
      } else {
        await this.prisma.monthlyBudget.upsert({
          where: { user_id_year_month_category: { user_id: userId, year_month: month, category: item.category } },
          update: { amount: item.amount },
          create: { user_id: userId, year_month: month, category: item.category, amount: item.amount },
        });
      }
    }

    return this.getMonthStatus(userId, month);
  }

  // 전달 잔여 예산을 현재 달에 이월 적용
  async applyCarryover(userId: number, month: string): Promise<void> {
    const [year, mon] = month.split('-').map(Number);
    const prevDate = new Date(Date.UTC(year, mon - 2, 1));
    const prevMonth = `${prevDate.getUTCFullYear()}-${String(prevDate.getUTCMonth() + 1).padStart(2, '0')}`;

    const { categories: prevCats } = await this.getMonthStatus(userId, prevMonth);

    for (const cat of prevCats) {
      const carryAmount = Math.max(0, cat.remaining);

      const existing = await this.prisma.monthlyBudget.findUnique({
        where: { user_id_year_month_category: { user_id: userId, year_month: month, category: cat.category } },
      });

      if (existing) {
        await this.prisma.monthlyBudget.update({
          where: { id: existing.id },
          data: { carried_over_amount: carryAmount },
        });
      } else if (carryAmount > 0) {
        await this.prisma.monthlyBudget.create({
          data: { user_id: userId, year_month: month, category: cat.category, amount: 0, carried_over_amount: carryAmount },
        });
      }
    }

    // 전달에 없는 카테고리의 기존 이월 초기화
    const prevCatCodes = prevCats.map((c) => c.category);
    if (prevCatCodes.length > 0) {
      await this.prisma.monthlyBudget.updateMany({
        where: { user_id: userId, year_month: month, category: { notIn: prevCatCodes }, carried_over_amount: { gt: 0 } },
        data: { carried_over_amount: 0 },
      });
    }
  }

  // 이월 초기화 (이월로만 생성된 amount=0 레코드는 함께 삭제)
  async resetCarryover(userId: number, month: string): Promise<void> {
    await this.prisma.monthlyBudget.updateMany({
      where: { user_id: userId, year_month: month, carried_over_amount: { gt: 0 } },
      data: { carried_over_amount: 0 },
    });
    await this.prisma.monthlyBudget.deleteMany({
      where: { user_id: userId, year_month: month, amount: 0, carried_over_amount: 0 },
    });
  }
}
