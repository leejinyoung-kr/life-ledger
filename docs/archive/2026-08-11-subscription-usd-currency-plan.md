# 구독 관리 달러(USD) 지원 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 구독마다 통화(KRW/USD)를 지정해 원래 통화로 저장·표시하고, 요약 통계(월/연 환산)는 조회 시점 환율로 원화 환산해 계산한다.

**Architecture:** `Subscription`에 `currency` enum 컬럼 추가. 환율 조회는 기존 `PriceLookupService.getExchangeRate('USD','KRW')`(frankfurter.app 연동 + 10분 캐시, 이미 구현됨)를 재사용한다. 프론트는 카드 표시만 통화 분기하고, 요약 통계는 백엔드가 이미 환산해서 내려주므로 그대로 쓴다.

**Tech Stack:** NestJS 11 + Prisma(MariaDB), Jest, Next.js 16 + React 19 + TypeScript, Tailwind CSS v4.

## Global Constraints

- DB 컬럼 추가 시 `COMMENT`를 함께 작성한다 (doc-nexus/CLAUDE.md "DB 컬럼 코멘트 규칙").
- 새 함수/메서드 위에는 동작을 설명하는 한 줄 한국어 주석을 단다 (doc-nexus/CLAUDE.md "코드 주석 규칙").
- 새 서비스를 만들지 않고 `backend/src/investment/price-lookup.service.ts`의 `PriceLookupService`를 재사용한다.
- 환율 변동 이력 저장, USD 외 통화(엔·유로 등), 실시간 환율 UI 노출은 범위 밖(스펙 참고: `docs/archive/2026-08-11-subscription-usd-currency-design.md`).

---

### Task 1: Prisma 스키마 — `Subscription.currency` 컬럼 추가

**Files:**
- Modify: `backend/prisma/schema.prisma` (Subscription 모델, 261-282번째 줄 부근)
- Create: `backend/prisma/migrations/<timestamp>_add_subscription_currency/migration.sql` (prisma가 생성, 이후 코멘트 보강)

**Interfaces:**
- Produces: Prisma 클라이언트 타입 `SubscriptionCurrency` (`'KRW' | 'USD'`), `Subscription.currency` 필드 (기본값 `KRW`). 이후 태스크에서 이 타입/필드명을 그대로 쓴다.

- [ ] **Step 1: `schema.prisma`에 enum과 컬럼 추가**

`enum SubscriptionStatus { ... }` 블록(현재 252-259번째 줄) 바로 아래, `model Subscription {` 위에 새 enum을 추가한다:

```prisma
/// 구독 통화: KRW(원화) | USD(달러)
enum SubscriptionCurrency {
  KRW
  USD

  @@map("subscription_currency")
}
```

`model Subscription` 내부 `amount` 필드 바로 아래 줄에 `currency` 필드를 추가한다 (수정 후 모습):

```prisma
model Subscription {
  id                Int                  @id @default(autoincrement())
  user_id           Int /// user.id FK
  name              String               @db.VarChar(100)
  category          String               @db.VarChar(50)
  amount            Decimal              @db.Decimal(15, 2)
  currency          SubscriptionCurrency @default(KRW)
  cycle             SubscriptionCycle    @default(monthly)
  status            SubscriptionStatus   @default(active)
  next_payment_date DateTime             @db.Date
  pay_method        String               @db.VarChar(50)
  last_used_at      DateTime?            @db.Date
  memo              String?              @db.VarChar(300)
  deleted_at        DateTime?
  created_at        DateTime             @default(now())
  updated_at        DateTime             @updatedAt

  user User @relation(fields: [user_id], references: [id], onDelete: Cascade)

  @@index([user_id])
  @@map("subscription")
}
```

- [ ] **Step 2: 마이그레이션 생성 (DB 실행 중이어야 함 — 먼저 `pnpm run db` 확인)**

Run: `cd backend && npx prisma migrate dev --name add_subscription_currency --create-only`

이 명령은 SQL만 생성하고 아직 적용하지 않는다.

- [ ] **Step 3: 생성된 migration.sql에 COMMENT 보강**

`backend/prisma/migrations/<timestamp>_add_subscription_currency/migration.sql`을 열어 생성된 `ALTER TABLE` 문에 `COMMENT`가 없으면 추가한다. 최종 파일 내용은 다음과 같아야 한다 (enum 값 순서는 prisma가 생성한 그대로 유지, 컬럼 위치만 `amount` 뒤인지 확인):

```sql
-- AlterTable
ALTER TABLE `subscription` ADD COLUMN `currency` ENUM('KRW', 'USD') NOT NULL DEFAULT 'KRW' COMMENT '통화' AFTER `amount`;
```

- [ ] **Step 4: 마이그레이션 적용 + 클라이언트 재생성**

Run: `cd backend && npx prisma migrate dev`

Expected: `Already in sync, no schema change or pending migration was found.` 또는 마이그레이션이 정상 적용됐다는 메시지. 에러 없이 종료되어야 한다.

- [ ] **Step 5: Prisma 클라이언트에 `SubscriptionCurrency` 타입이 생성됐는지 확인**

Run: `cd backend && npx tsc --noEmit -p .`

Expected: 에러 없음 (아직 `currency`를 쓰는 코드가 없으므로 통과해야 정상).

- [ ] **Step 6: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations
git commit -m "feat(subscription): currency 컬럼 추가 (KRW/USD)"
```

---

### Task 2: 백엔드 DTO — `currency` 필드 추가

**Files:**
- Modify: `backend/src/subscription/dto/create-subscription.dto.ts`
- (update-subscription.dto.ts는 `PartialType(CreateSubscriptionDto)`라 자동 반영, 수정 불필요)

**Interfaces:**
- Consumes: Task 1의 `SubscriptionCurrency` Prisma enum 타입.
- Produces: `CreateSubscriptionDto.currency?: SubscriptionCurrency` (옵션, 기본값은 서비스 레이어에서 KRW 처리).

- [ ] **Step 1: `create-subscription.dto.ts` 수정**

`import { SubscriptionCycle, SubscriptionStatus } from '@prisma/client';`를 다음으로 교체:

```typescript
import { SubscriptionCurrency, SubscriptionCycle, SubscriptionStatus } from '@prisma/client';
```

`amount` 필드 바로 아래에 다음 필드를 추가:

```typescript
  // 통화 (KRW/USD). 미지정 시 서비스 레이어에서 KRW로 처리
  @IsOptional()
  @IsEnum(SubscriptionCurrency)
  currency?: SubscriptionCurrency;
```

- [ ] **Step 2: 타입체크로 검증**

Run: `cd backend && npx tsc --noEmit -p .`

Expected: 에러 없음.

- [ ] **Step 3: Commit**

```bash
git add backend/src/subscription/dto/create-subscription.dto.ts
git commit -m "feat(subscription): DTO에 currency 필드 추가"
```

---

### Task 3: 백엔드 서비스 — 환율 환산 로직 + 테스트

**Files:**
- Modify: `backend/src/subscription/subscription.service.ts`
- Modify: `backend/src/subscription/subscription.module.ts`
- Create: `backend/src/subscription/subscription.service.spec.ts`

**Interfaces:**
- Consumes: `PriceLookupService.getExchangeRate(from: string, to: string): Promise<number>` (`backend/src/investment/price-lookup.service.ts:81`).
- Consumes: Task 1의 `Subscription.currency`, Task 2의 `CreateSubscriptionDto.currency`.
- Produces: `SubscriptionService.toDto()` 응답에 `currency: 'KRW' | 'USD'` 포함. `summary()`는 이전과 동일한 반환 shape(`monthlyTotal, yearlyTotal, activeCount, nextPayment, trial`) 유지 — USD 구독이 섞여도 원화 환산된 합계로 계산.

- [ ] **Step 1: 실패하는 테스트 작성**

`backend/src/subscription/subscription.service.spec.ts` 새로 생성:

```typescript
import { SubscriptionService } from './subscription.service';
import { PriceLookupService } from '../investment/price-lookup.service';
import { Prisma } from '@prisma/client';

// summary() 의 환율 환산 로직 검증. Prisma 는 인메모리 가짜, PriceLookupService 는 모킹.
describe('SubscriptionService.summary', () => {
  let rows: any[];
  let prisma: any;
  let priceLookup: PriceLookupService;
  const svc = () => new SubscriptionService(prisma, priceLookup);

  beforeEach(() => {
    rows = [];
    prisma = {
      subscription: {
        findMany: jest.fn(async ({ where }: any) =>
          rows.filter((r) => r.user_id === where.user_id && r.deleted_at == null),
        ),
      },
    };
    priceLookup = { getExchangeRate: jest.fn(async () => 1400) } as unknown as PriceLookupService;
  });

  function row(overrides: Partial<any>) {
    rows.push({
      id: rows.length + 1,
      user_id: 1,
      name: '테스트 구독',
      category: 'ott',
      amount: new Prisma.Decimal(overrides.amount ?? 10000),
      currency: overrides.currency ?? 'KRW',
      cycle: overrides.cycle ?? 'monthly',
      status: overrides.status ?? 'active',
      next_payment_date: overrides.next_payment_date ?? new Date('2099-01-01'),
      pay_method: '신한카드',
      last_used_at: null,
      memo: null,
      deleted_at: null,
      ...overrides,
    });
  }

  it('KRW 구독만 있으면 환율 API를 호출하지 않는다', async () => {
    row({ amount: 10000, currency: 'KRW' });
    const res = await svc().summary(1);
    expect(res.monthlyTotal).toBe(10000);
    expect(priceLookup.getExchangeRate).not.toHaveBeenCalled();
  });

  it('USD 구독은 환율을 반영해 원화 합계에 더해진다', async () => {
    row({ amount: 10000, currency: 'KRW' });
    row({ amount: 10, currency: 'USD' }); // 10 * 1400 = 14000
    const res = await svc().summary(1);
    expect(priceLookup.getExchangeRate).toHaveBeenCalledWith('USD', 'KRW');
    expect(res.monthlyTotal).toBe(24000);
    expect(res.yearlyTotal).toBe(24000 * 12);
  });
});
```

- [ ] **Step 2: 테스트 실행해서 실패 확인**

Run: `cd backend && npx jest subscription.service.spec.ts`

Expected: FAIL — `SubscriptionService` 생성자가 `PriceLookupService`를 받지 않거나(타입 에러), `currency`를 모르는 상태라 컴파일/런타임 에러.

- [ ] **Step 3: `subscription.service.ts` 수정**

`toMonthly` 함수를 다음으로 교체 (환율 인자 추가):

```typescript
// 주기별 청구액을 월 기준으로 환산 (연→/12, 주→*52/12). USD면 rate로 원화 환산 후 계산
function toMonthly(amount: number, cycle: SubscriptionCycle, currency: SubscriptionCurrency, usdToKrwRate: number): number {
  const krwAmount = currency === 'USD' ? amount * usdToKrwRate : amount;
  if (cycle === 'yearly') return krwAmount / 12;
  if (cycle === 'weekly') return (krwAmount * 52) / 12;
  return krwAmount;
}
```

import 문 상단을 다음으로 교체:

```typescript
import { Prisma, Subscription, SubscriptionCurrency, SubscriptionCycle } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PriceLookupService } from '../investment/price-lookup.service';
import { parsePage } from '@leejinyoun/core-common';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { QuerySubscriptionDto } from './dto/query-subscription.dto';
import { UpdateSubscriptionDto } from './dto/update-subscription.dto';
```

생성자와 `toDto`를 수정:

```typescript
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
```

`summary()` 메서드를 다음으로 교체 (USD 구독이 있을 때만 환율 조회):

```typescript
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

    // 다음 결제 임박 — 오늘 이후 가장 가까운 결제일
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
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
```

`create()` 메서드의 `data` 객체에 `currency` 라인을 `amount` 바로 아래 추가:

```typescript
        amount: new Prisma.Decimal(dto.amount),
        currency: dto.currency ?? 'KRW',
```

`update()` 메서드의 `data` 객체에 `currency` 라인을 `amount` 바로 아래 추가:

```typescript
        amount: dto.amount !== undefined ? new Prisma.Decimal(dto.amount) : undefined,
        currency: dto.currency,
```

- [ ] **Step 4: `subscription.module.ts`에 `PriceLookupService` 추가**

```typescript
import { Module } from '@nestjs/common';
import { SubscriptionController } from './subscription.controller';
import { SubscriptionService } from './subscription.service';
import { PriceLookupService } from '../investment/price-lookup.service';

@Module({
  controllers: [SubscriptionController],
  providers: [SubscriptionService, PriceLookupService],
})
export class SubscriptionModule {}
```

- [ ] **Step 5: 테스트 재실행해서 통과 확인**

Run: `cd backend && npx jest subscription.service.spec.ts`

Expected: PASS (2 tests).

- [ ] **Step 6: 전체 타입체크**

Run: `cd backend && npx tsc --noEmit -p .`

Expected: 에러 없음.

- [ ] **Step 7: Commit**

```bash
git add backend/src/subscription/subscription.service.ts backend/src/subscription/subscription.module.ts backend/src/subscription/subscription.service.spec.ts
git commit -m "feat(subscription): USD 구독 환율 환산 로직 추가"
```

---

### Task 4: 프론트엔드 타입 — `currency` 필드 추가

**Files:**
- Modify: `frontend/lib/subscription.ts`

**Interfaces:**
- Consumes: 없음 (백엔드 응답 shape에 맞춤).
- Produces: `Subscription.currency: 'KRW' | 'USD'`. Task 5에서 이 필드로 표시 포맷을 분기한다.

- [ ] **Step 1: `Subscription` 인터페이스에 필드 추가**

`frontend/lib/subscription.ts`의 `Subscription` 인터페이스에서 `amount` 줄 바로 아래에 추가:

```typescript
export interface Subscription {
  id: number;
  name: string;
  category: string; // 코드
  amount: number;
  currency: 'KRW' | 'USD';
  cycle: SubscriptionCycle;
  status: SubscriptionStatus;
  nextPaymentDate: string; // YYYY-MM-DD
  payMethod: string;
  lastUsedAt: string | null;
  memo: string | null;
}
```

파일 하단 `SUB_PAY_METHODS` 아래에 통화 라벨 상수를 추가:

```typescript
export const SUB_CURRENCY_LABEL: Record<'KRW' | 'USD', string> = {
  KRW: '원화',
  USD: '달러',
};
```

- [ ] **Step 2: 타입체크**

Run: `cd frontend && npx tsc --noEmit`

Expected: 에러 없음 (아직 이 필드를 쓰는 컴포넌트가 없으므로 통과해야 정상 — 백엔드가 이미 `currency`를 내려주므로 런타임에는 문제 없음).

- [ ] **Step 3: Commit**

```bash
git add frontend/lib/subscription.ts
git commit -m "feat(subscription): currency 타입 및 라벨 추가"
```

---

### Task 5: 프론트엔드 UI — 카드 통화 표시 + 폼 통화 선택

**Files:**
- Modify: `frontend/app/(app)/subscriptions/page.tsx`

**Interfaces:**
- Consumes: Task 4의 `Subscription.currency`, `SUB_CURRENCY_LABEL`. `usd()`/`won()` (`frontend/lib/finance.ts:225-232`, 이미 존재).

- [ ] **Step 1: import에 `usd`와 `SUB_CURRENCY_LABEL` 추가**

`import { won, dotDate, daysUntil } from '@/lib/finance';`를 다음으로 교체:

```typescript
import { won, usd, dotDate, daysUntil } from '@/lib/finance';
```

`SUB_CATEGORY_LABEL, ...` import 블록에 `SUB_CURRENCY_LABEL`을 추가:

```typescript
import {
  SUB_CATEGORY_LABEL, SUB_CATEGORY_EMOJI, SUB_CATEGORY_OPTIONS,
  CYCLE_LABEL, STATUS_LABEL, SUB_PAY_METHODS, SUB_CURRENCY_LABEL,
  type Subscription, type SubscriptionCycle, type SubscriptionStatus,
} from '@/lib/subscription';
```

- [ ] **Step 2: 구독 카드 금액 표시를 통화별로 분기**

`page.tsx`의 카드 렌더링 부분에서 다음 블록을 찾는다:

```typescript
              <div className="[font-family:var(--font-display)] text-[1.4rem] font-bold text-primary tracking-[-0.03em]">
                {won(sub.amount)}<span className="text-[0.75rem] text-muted ml-1 font-normal [font-family:var(--font-body)]">/{CYCLE_LABEL[sub.cycle]}</span>
              </div>
```

다음으로 교체:

```typescript
              <div className="[font-family:var(--font-display)] text-[1.4rem] font-bold text-primary tracking-[-0.03em]">
                {sub.currency === 'USD' ? usd(sub.amount) : won(sub.amount)}<span className="text-[0.75rem] text-muted ml-1 font-normal [font-family:var(--font-body)]">/{CYCLE_LABEL[sub.cycle]}</span>
              </div>
```

- [ ] **Step 3: `SubscriptionModal`에 통화 state 추가**

`const [amount, setAmount] = useState('');` 바로 아래에 추가:

```typescript
  const [currency, setCurrency] = useState<'KRW' | 'USD'>('KRW');
```

폼 초기화 `useEffect` 안, `setAmount(e ? String(e.amount) : '');` 바로 아래에 추가:

```typescript
    setCurrency(e?.currency ?? 'KRW');
```

- [ ] **Step 4: `handleSave`의 payload에 `currency` 추가**

```typescript
      const payload = {
        name, category, amount: Number(amount), currency, cycle, status,
        nextPaymentDate, payMethod,
        lastUsedAt: lastUsedAt || undefined, memo: memo || undefined,
      };
```

- [ ] **Step 5: "금액 (원)" Field 옆에 통화 select 추가**

다음 블록을 찾는다:

```typescript
      <div className="grid grid-cols-2 gap-4 max-md:grid-cols-1">
        <Field label="금액 (원)" required error={errors.amount}>
          <input type="number" className={`input${errors.amount ? ' is-invalid' : ''}`} placeholder="0" value={amount} onChange={(ev) => { setAmount(ev.target.value); clearError('amount'); }} />
        </Field>
        <Field label="결제 주기" required>
          <select className="input" aria-label="결제 주기" value={cycle} onChange={(ev) => setCycle(ev.target.value as SubscriptionCycle)}>
            <option value="monthly">매월</option><option value="yearly">매년</option><option value="weekly">매주</option>
          </select>
        </Field>
      </div>
```

다음으로 교체 (통화 select를 별도 줄로 추가하고 라벨을 "금액"으로 통일):

```typescript
      <div className="grid grid-cols-2 gap-4 max-md:grid-cols-1">
        <Field label="금액" required error={errors.amount}>
          <input type="number" className={`input${errors.amount ? ' is-invalid' : ''}`} placeholder="0" value={amount} onChange={(ev) => { setAmount(ev.target.value); clearError('amount'); }} />
        </Field>
        <Field label="통화" required>
          <select className="input" aria-label="통화" value={currency} onChange={(ev) => setCurrency(ev.target.value as 'KRW' | 'USD')}>
            {(Object.keys(SUB_CURRENCY_LABEL) as ('KRW' | 'USD')[]).map((c) => <option key={c} value={c}>{SUB_CURRENCY_LABEL[c]}</option>)}
          </select>
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-4 max-md:grid-cols-1">
        <Field label="결제 주기" required>
          <select className="input" aria-label="결제 주기" value={cycle} onChange={(ev) => setCycle(ev.target.value as SubscriptionCycle)}>
            <option value="monthly">매월</option><option value="yearly">매년</option><option value="weekly">매주</option>
          </select>
        </Field>
        <Field label="다음 결제일" required error={errors.nextPaymentDate}>
          <input type="date" className={`input${errors.nextPaymentDate ? ' is-invalid' : ''}`} aria-label="다음 결제일" value={nextPaymentDate} onChange={(ev) => { setNextPaymentDate(ev.target.value); clearError('nextPaymentDate'); }} />
        </Field>
      </div>
```

이 교체는 기존에 "다음 결제일"이 들어있던 그 다음 `<div className="grid grid-cols-2 ...">` 블록(현재 "다음 결제일" + "상태")과 겹치므로, 바로 아래 있는 기존 블록에서 "다음 결제일" `Field`를 제거하고 "상태" `Field`만 남긴 1-컬럼 블록으로 조정한다:

```typescript
      <Field label="상태">
        <select className="input" aria-label="상태" value={status} onChange={(ev) => setStatus(ev.target.value as SubscriptionStatus)}>
          <option value="active">활성</option><option value="trial">체험</option><option value="paused">일시정지</option>
        </select>
      </Field>
```

- [ ] **Step 6: 타입체크**

Run: `cd frontend && npx tsc --noEmit`

Expected: 에러 없음.

- [ ] **Step 7: 개발 서버로 수동 확인**

Run: `pnpm dev` (루트에서, 또는 `pnpm run dev:frontend` + `pnpm run dev:backend`)

브라우저에서 `/subscriptions` 접속 후:
1. "구독 추가" → 통화를 "달러"로 선택, 금액 `15.99`, 나머지 입력 후 저장 → 카드에 `$15.99`로 표시되는지 확인
2. 상단 "월 구독료 합계" 통계가 원화로 환산되어 증가했는지 확인 (환율 API 실패 시 요약 카드에 에러 배너가 뜰 수 있음 — 이 경우 네트워크 상태 확인)
3. 기존 원화 구독은 그대로 `₩` 표시 유지되는지 확인

- [ ] **Step 8: Commit**

```bash
git add "frontend/app/(app)/subscriptions/page.tsx"
git commit -m "feat(subscription): 카드/폼에 통화(KRW/USD) 표시 및 선택 추가"
```

---

## Self-Review 결과 (계획 작성자 확인용)

- **스펙 커버리지:** DB 컬럼(Task 1), 요약 환산(Task 3), 카드/폼 통화 표시(Task 5) 모두 스펙 항목과 1:1 대응. 스펙의 "범위 밖" 항목(환율 이력, 실시간 환율 UI, 타 통화)은 계획에 포함하지 않음 — 일치.
- **플레이스홀더:** 없음 — 모든 스텝에 실제 코드/명령어 포함.
- **타입 일관성:** `SubscriptionCurrency`(Prisma) ↔ `'KRW' | 'USD'`(프론트 TS 유니언) 로 이름은 다르지만 값은 동일 — 백엔드는 Prisma 생성 타입을, 프론트는 API JSON 문자열을 그대로 쓰므로 별도 매핑 불필요.
