# DocNexus — ERD

## 테이블 목록

| 테이블 | 설명 | 상태 |
| --- | --- | --- |
| User | 사용자 | 구현 완료 |
| Transaction | 수입/지출 내역 | 구현 완료 |
| Saving | 예적금 | 구현 완료 |
| Investment | 투자 | 구현 완료 |
| Subscription | 구독 서비스 | 구현 완료 |
| Asset | 자산 항목 | 구현 완료 |
| NetWorthSnapshot | 순자산 스냅샷 | 구현 완료 |
| UserSettings | 사용자 설정 | 구현 완료 |
| Notification | 알림 | 구현 완료 |
| Task | 할 일 | 구현 완료 |
| Goal | 목표 | 구현 완료 |
| Note | 메모/노트 | 구현 완료 |
| CalendarEvent | 캘린더 이벤트 | 구현 완료 |
| SecurityRisk | 보안 위험 항목 | 구현 완료 |
| LoginSession | 로그인 세션 | 구현 완료 |
| Category | 카테고리 관리 | 구현 완료 |

## 주요 관계

```text
User 1 ─── N Transaction
User 1 ─── N Saving
User 1 ─── N Investment
User 1 ─── N Subscription
User 1 ─── N Asset
User 1 ─── N NetWorthSnapshot
User 1 ─── 1 UserSettings
User 1 ─── N Notification
User 1 ─── N Task
User 1 ─── N Goal
User 1 ─── N Note
User 1 ─── N CalendarEvent
User 1 ─── N SecurityRisk
User 1 ─── N LoginSession
User 1 ─── N Category
```

## 스키마 (Prisma)

`backend/prisma/schema.prisma` 참고.

### User

```prisma
model User {
  id         Int      @id @default(autoincrement())
  google_id  String   @unique @db.VarChar(100)
  email      String   @unique @db.VarChar(200)
  name       String   @db.VarChar(100)
  picture    String?  @db.VarChar(500)
  created_at DateTime @default(now())
  updated_at DateTime @updatedAt

  @@map("user")
}
```

### Transaction / Saving / Investment (가계부)

- `Transaction` — 수입/지출 내역. `type`(income/expense/transfer), `category`(코드), `amount`, `pay_method`, `is_recurring`, `recurring_rule`(JSON), soft delete(`deleted_at`)
- `Saving` — 예적금. `type`(savings/deposit/subscription/etc), `interest_rate`, `monthly_amount`, `maturity_date`, `balance`
- `Investment` — 투자. `type`(domestic_stock/foreign_stock/foreign_etf/domestic_etf/crypto/etc), `principal`, `current_value`, `purchase_date`

마이그레이션: `migrations/20260602093000_finance/`

### Subscription / Asset / NetWorthSnapshot (순자산)

- `Subscription` — 구독 서비스. `name`, `amount`, `billing_cycle`(monthly/yearly/weekly), `next_billing_date`, soft delete(`deleted_at`)
- `Asset` — 자산 항목. `name`, `type`(cash/stock/real_estate/crypto/etc), `value`
- `NetWorthSnapshot` — 순자산 스냅샷. `total_assets`, `total_liabilities`, `net_worth`, `recorded_at`

마이그레이션: `migrations/20260602160000_asset/`

### UserSettings

- 사용자별 설정. `currency`, `language`, `timezone`, `notification_enabled` 등

마이그레이션: `migrations/20260602170000_user_settings/`

### Notification

- `type`, `title`, `message`, `is_read`, `read_at`

마이그레이션: `migrations/20260602180000_notification/`

### Task / Goal (할 일 + 목표)

- `Task` — `title`, `due_date`, `is_done`, `priority`(low/medium/high), soft delete
- `Goal` — `title`, `target_amount`, `current_amount`, `deadline`, soft delete

마이그레이션: `migrations/20260602190000_task_goal/`

### Note

- `title`, `content`(TEXT), `tags`(JSON), `is_pinned`, soft delete

마이그레이션: `migrations/20260602200000_note/`

### CalendarEvent

- `title`, `start_at`, `end_at`, `all_day`, `type`, `color`, soft delete

마이그레이션: `migrations/20260602210000_calendar_event/`

### SecurityRisk / LoginSession (보안)

- `SecurityRisk` — `type`, `description`, `severity`, `resolved_at`
- `LoginSession` — `device`, `browser`, `ip`, `location`, `revoked_at`

마이그레이션: `migrations/20260602220000_security/`
