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
| IdentityCard | 신원 지갑 (번호 암호화) | 구현 완료 |
| Credential | 계정 보관함 (비번/TOTP 암호화) | 구현 완료 |
| EnvProject | ENV 프로젝트 | 구현 완료 |
| EnvVar | ENV 변수 (값 암호화) | 구현 완료 |

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
User 1 ─── N IdentityCard
User 1 ─── N Credential
User 1 ─── N EnvProject
User 1 ─── N EnvVar
EnvProject 1 ─── N EnvVar
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

### IdentityCard / Credential / EnvProject / EnvVar (보관함)

민감 필드는 AES-256-GCM 암호문(`v1:iv:tag:cipher`)으로 저장하며, 목록은 마스킹, 원문은 reveal 엔드포인트로만 제공한다.

- `IdentityCard` — 신원 지갑. `type`(passport/idcard/license/cert/etc), `name`, `number_enc`(암호문), `issue_date`, `expire_date`
- `Credential` — 계정 보관함. `name`, `emoji`, `url`, `category`, `username`, `password_enc`(암호문), `totp_enc`(암호문, 선택)
- `EnvProject` — ENV 프로젝트. `emoji`, `name`, `description`
- `EnvVar` — ENV 변수. `project_id`(FK), `env`(dev/staging/prod), `group`, `key`, `value_enc`(암호문)

마이그레이션: `migrations/20260606000000_credential_vault/`

### Transaction 반복 (회차)

`Transaction` 에 반복 자동 생성용 컬럼 추가: `recurring_parent_id`(원본 FK), `recurring_period`(회차 식별), `recurring_overridden`(개별 수정 보존 플래그).

마이그레이션: `migrations/20260605000000_transaction_recurring_occurrence/`, `migrations/20260607000000_transaction_recurring_overridden/`
