/**
 * 1회성 데이터 이관 스크립트 — 인라인 반복거래(Transaction.is_recurring)/반복매수
 * (Investment.recurring_buy_*)를 새 RecurringSchedule 테이블로 옮긴다.
 *
 * 실행 순서 (schema.prisma는 최종 상태 그대로 두고, 마이그레이션만 단계별로 적용):
 *   1. prisma/migrations/xxxx_add_recurring_schedule (recurring_schedule 테이블 + transaction.recurring_schedule_id 추가, 기존 컬럼은 유지된 상태로 적용)
 *   2. 이 스크립트 실행 — npx tsx scripts/migrate-recurring-schedules.ts
 *   3. prisma/migrations/xxxx_drop_legacy_recurring_columns (기존 is_recurring/recurring_rule/recurring_overridden/recurring_parent_id, recurring_buy_* drop)
 *
 * 1단계와 3단계 사이 짧은 구간에만 존재하는 레거시 컬럼을 다루므로, 최종 스키마 기준으로 생성되는
 * Prisma Client 타입에는 없는 컬럼이다 — 그래서 이 스크립트는 해당 컬럼을 타입 없는 raw SQL로 읽는다.
 * 여러 번 실행해도 안전(idempotent) — 이미 recurring_schedule_id가 채워진 행/스케줄은 건너뜀.
 */
import { PrismaClient, Prisma } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { periodOf, type RRule } from '../src/transaction/recurring.util';

const adapter = new PrismaMariaDb(process.env.DATABASE_URL!);
const prisma = new PrismaClient({ adapter });

interface LegacyTransactionTemplate {
  id: number;
  user_id: number;
  type: 'income' | 'expense' | 'transfer';
  date: Date;
  title: string;
  category: string;
  amount: string;
  pay_method: string;
  memo: string | null;
  recurring_rule: unknown;
  recurring_period: string | null;
  target_type: 'saving' | 'investment' | 'asset' | null;
  target_id: number | null;
  target_direction: 'increase' | 'decrease' | null;
}

interface LegacyChild {
  id: number;
  recurring_period: string | null;
}

interface LegacyRecurringInvestment {
  id: number;
  user_id: number;
  name: string;
  purchase_date: Date | null;
  recurring_buy_rule: unknown;
  recurring_buy_amount: string | null;
  recurring_buy_quantity: string | null;
  recurring_buy_last_period: string | null;
}

async function migrateTransactionTemplates(): Promise<number> {
  const templates = await prisma.$queryRaw<LegacyTransactionTemplate[]>`
    SELECT id, user_id, type, date, title, category, amount, pay_method, memo,
           recurring_rule, recurring_period, target_type, target_id, target_direction
    FROM \`transaction\`
    WHERE is_recurring = 1 AND recurring_schedule_id IS NULL
  `;
  let created = 0;

  for (const t of templates) {
    const rule = t.recurring_rule as unknown as RRule | null;
    if (!rule?.cycle) {
      console.warn(`[skip] transaction #${t.id} — 반복 규칙 없음`);
      continue;
    }

    const children = await prisma.$queryRaw<LegacyChild[]>`
      SELECT id, recurring_period FROM \`transaction\` WHERE recurring_parent_id = ${t.id}
    `;
    const periods = [t.recurring_period ?? periodOf(t.date, rule.cycle), ...children.map((c) => c.recurring_period)]
      .filter((p): p is string => !!p)
      .sort();
    const lastPeriod = periods[periods.length - 1] ?? null;

    const schedule = await prisma.recurringSchedule.create({
      data: {
        user_id: t.user_id,
        kind: 'transaction',
        rule: t.recurring_rule as Prisma.InputJsonValue,
        start_date: t.date,
        last_period: lastPeriod,
        active: true,
        tx_type: t.type,
        title: t.title,
        category: t.category,
        amount: new Prisma.Decimal(t.amount),
        pay_method: t.pay_method,
        memo: t.memo,
        target_type: t.target_type,
        target_id: t.target_id,
        target_direction: t.target_direction,
      },
    });

    await prisma.transaction.update({
      where: { id: t.id },
      data: { recurring_schedule_id: schedule.id },
    });
    if (children.length) {
      await prisma.transaction.updateMany({
        where: { id: { in: children.map((c) => c.id) } },
        data: { recurring_schedule_id: schedule.id },
      });
    }

    console.log(`[ok] transaction #${t.id} '${t.title}' → recurring_schedule #${schedule.id} (회차 ${children.length}건 연결)`);
    created += 1;
  }
  return created;
}

async function migrateInvestmentRecurringBuys(): Promise<number> {
  const rows = await prisma.$queryRaw<LegacyRecurringInvestment[]>`
    SELECT id, user_id, name, purchase_date, recurring_buy_rule,
           recurring_buy_amount, recurring_buy_quantity, recurring_buy_last_period
    FROM \`investment\`
    WHERE recurring_buy_enabled = 1
  `;
  let created = 0;

  for (const inv of rows) {
    const rule = inv.recurring_buy_rule as unknown as RRule | null;
    if (!rule?.cycle || !inv.purchase_date) {
      console.warn(`[skip] investment #${inv.id} — 반복 규칙/매수일 없음`);
      continue;
    }
    const existing = await prisma.recurringSchedule.findFirst({
      where: { kind: 'investment', investment_id: inv.id },
    });
    if (existing) {
      console.log(`[skip] investment #${inv.id} — 이미 스케줄 #${existing.id} 존재`);
      continue;
    }

    const schedule = await prisma.recurringSchedule.create({
      data: {
        user_id: inv.user_id,
        kind: 'investment',
        rule: inv.recurring_buy_rule as Prisma.InputJsonValue,
        start_date: inv.purchase_date,
        last_period: inv.recurring_buy_last_period,
        active: true,
        investment_id: inv.id,
        buy_amount: inv.recurring_buy_amount ? new Prisma.Decimal(inv.recurring_buy_amount) : null,
        buy_quantity: inv.recurring_buy_quantity ? new Prisma.Decimal(inv.recurring_buy_quantity) : null,
      },
    });

    console.log(`[ok] investment #${inv.id} '${inv.name}' → recurring_schedule #${schedule.id}`);
    created += 1;
  }
  return created;
}

async function main() {
  const txCount = await migrateTransactionTemplates();
  const invCount = await migrateInvestmentRecurringBuys();
  console.log(`\n완료: 거래 스케줄 ${txCount}건, 투자 스케줄 ${invCount}건 생성`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
