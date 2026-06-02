# DocNexus — ERD

## 테이블 목록

| 테이블 | 설명 |
|--------|------|
| User | 사용자 |
| Menu | 사용자별 메뉴 설정 |
| Transaction | 수입/지출 내역 |
| Budget | 카테고리별 예산 |
| Credential | 계정 보관함 (암호화) |
| File | 파일 메타데이터 |
| Folder | 폴더 구조 |
| Note | 메모/노트 |
| Saving | 예적금 |
| Investment | 투자 |
| Notification | 알림 |
| Report | AI 리포트 |
| WidgetSetting | 대시보드 위젯 설정 |

## 주요 관계

```
User 1 ─── N Transaction
User 1 ─── N Budget
User 1 ─── N Credential
User 1 ─── N Folder
Folder 1 ─── N File
User 1 ─── N Note
User 1 ─── N Saving
User 1 ─── N Investment
User 1 ─── N Notification
User 1 ─── N Report
User 1 ─── 1 WidgetSetting
User 1 ─── N Menu
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

### Transaction / Saving / Investment (구현 완료 — 가계부)

- `Transaction` — 수입/지출 내역. `type`(income/expense/transfer), `category`(코드), `amount`, `pay_method`, `is_recurring`, `recurring_rule`(JSON), soft delete(`deleted_at`)
- `Saving` — 예적금. `type`(savings/deposit/subscription/etc), `interest_rate`, `monthly_amount`, `maturity_date`, `balance`
- `Investment` — 투자. `type`(domestic_stock/foreign_stock/foreign_etf/domestic_etf/crypto/etc), `principal`, `current_value`, `purchase_date`

모두 `user_id` FK + KST 트리거 포함. 상세는 `backend/prisma/schema.prisma` 및 `migrations/20260602093000_finance/`.

> 나머지 테이블(Budget/Credential/File/Folder/Note/Notification/Report/WidgetSetting/Menu)은 미구현 — 설계 예정 항목임
