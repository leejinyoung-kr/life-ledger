# DocNexus — ERD

> 단일 소스: `backend/prisma/schema.prisma` · DB: MariaDB(utf8mb4_unicode_ci)
> 마이그레이션: `20260713000000_init`(전 도메인 통합) + `20260715104820_add_recurring_schedule` · `20260715105206_drop_legacy_recurring_columns` · `20260731121236_remove_note_task_calendar`

## 테이블 목록 (30)

| 테이블 | 설명 |
| --- | --- |
| User | 사용자 (Google OAuth) |
| Transaction | 수입/지출 내역 |
| RecurringSchedule | 자동이체 설정 (반복거래/반복매수 자동 생성 규칙 — 거래·투자 등록 폼과 분리) |
| Saving | 예적금 |
| InvestmentAccount | 투자 계좌 (예수금 보유 — 종목 여러 개가 공유) |
| Investment | 투자 종목 (소속 계좌의 예수금을 매수/매도로 전환) |
| Subscription | 구독 서비스 |
| Asset | 자산/부채 항목 |
| NetWorthSnapshot | 순자산 월별 스냅샷 |
| UserSettings | 사용자 설정 (1:1) |
| Notification | 알림 |
| Goal | 목표 |
| SecurityRisk | 보안 위험 (시드/표시용) |
| LoginSession | 로그인 세션 |
| Category | 카테고리 (도메인별, 가계부는 대분류→소분류 2계층) |
| IdentityCard | 신원 지갑 (번호 AES + 사본 fileId) |
| Credential | 계정 보관함 (비번·TOTP·백업코드 AES) |
| EnvProject | ENV 프로젝트 |
| EnvVar | ENV 변수 (값 AES) |
| EnvVarHistory | ENV 변수 값 변경 이력 (롤백) |
| StorageFolder | 파일 보관함 폴더 (무한 중첩) |
| StorageFile | 파일 메타 (B2 object_key·SHA-256 hash) |
| AccessLog | 보관함 접근 감사 로그 |
| SecurityScoreSnapshot | 보안 점수 일별 스냅샷 |
| AiReport | AI 리포트 (가계부 분석·소비 패턴·절약 인사이트) |
| PushSubscription | 웹 푸시 구독 (endpoint·p256dh·auth) |
| AiUsageLog | AI 사용량 로그 (OpenAI 호출별 모델·토큰·비용 — 잔액 API 부재 대체) |
| RefreshToken | 갱신 토큰 화이트리스트 (jti, rotation/로그아웃/세션revoke 시 폐기) |
| EmailLoginCode | 이메일 인증코드 로그인 (code_hash, expires_at, attempts) |
| SystemLog | 시스템 로그 (크론·투자 현재가 갱신 등 백그라운드 작업 실행 기록, 90일 경과 시 자동 삭제) |

## 주요 관계

```text
User 1 ─── N (Transaction, Saving, InvestmentAccount, Investment, Subscription, Asset, NetWorthSnapshot,
              Notification, Goal,
              SecurityRisk, LoginSession, Category, IdentityCard, Credential,
              EnvProject, EnvVar, StorageFolder, StorageFile, AccessLog, SecurityScoreSnapshot, AiReport, RefreshToken)
User 1 ─── 1 UserSettings
User 1 ─── N RecurringSchedule
RecurringSchedule 1 ─── N Transaction(recurring_schedule_id, 자동 생성 회차)
Investment 1 ─── N RecurringSchedule(investment_id, kind=investment 전용)
InvestmentAccount 1 ─── N Investment(account_id)
EnvProject     1 ─── N EnvVar
EnvVar         1 ─── N EnvVarHistory
StorageFolder  1 ─── N StorageFolder(parent_id, 자기참조) · N StorageFile
StorageFile    1 ─── N IdentityCard(file_id, 사본 이미지)
LoginSession   1 ─── N RefreshToken(session_id)
```

## 암호화 (보관함)

민감 필드는 AES-256-GCM 암호문(`v1:ivHex:tagHex:cipherHex`)으로 저장. 목록은 마스킹, 원문은 reveal 엔드포인트로만 제공.
키는 `CREDENTIAL_SECRET` 을 sha256 한 32바이트. 마스터 잠금 비번은 별도 scrypt 해시(`saltHex:hashHex`).

- `IdentityCard.number_enc` · `Credential.password_enc`·`totp_enc`·`backup_codes_enc` · `EnvVar.value_enc` · `EnvVarHistory.value_enc`

## 도메인별 요약

### 가계부 — Transaction / Saving / InvestmentAccount / Investment

- `Transaction` — `type`(income/expense/transfer), `category`(소분류 code 저장 — 대분류는 Category.parent_code 로 파생), `amount`, `pay_method`, `recurring_schedule_id`(RecurringSchedule FK — 자동이체 설정으로 생성된 회차인 경우)·`recurring_period`(회차 식별), `target_type`(saving/investment/asset)·`target_id` — transfer 거래가 가리키는 누적 대상(FK 아님, 지정 시 대상 잔액에 자동 반영. `investment` 대상은 `InvestmentAccount.id`를 가리킴), `target_direction`(increase/decrease — asset 대상 전용, 미지정 시 부채=감소·그 외=증가), soft delete
- `RecurringSchedule` — 자동이체(자동 생성) 설정. `kind`(transaction/investment), `rule`(JSON: cycle/day/month/weekendAdjust), `start_date`, `last_period`(중복 생성 방지), `active`(일시정지). `kind=transaction`이면 거래 생성에 필요한 `tx_type`·`title`·`category`·`amount`·`pay_method`·`memo`·`target_*` 필드 사용, `kind=investment`이면 `investment_id`(대상 종목 FK)·`buy_amount`·`buy_quantity` 사용. 등록/수정 폼과 별개로, 크론(`RecurringCronService`)이 이 규칙에 따라 거래/투자 데이터를 순수 생성만 한다
- `Saving` — `type`(savings/deposit/subscription/etc), `interest_rate`, `monthly_amount`, `maturity_date`, `balance`
- `InvestmentAccount` — `name`(계좌명, 예: ISA·일반위탁), `cash_balance`(예수금 — 자산이동으로 충전, 매수/매도로 보유 종목과 전환. 계좌 내 종목들이 공유), `account_number_enc`(계좌번호, AES-256-GCM 암호화 — 동일 계좌명 다중 보유 시 구분용, 응답 시 마스킹)
- `Investment` — `account_id`(InvestmentAccount FK), `type`(domestic_stock/foreign_stock/foreign_etf/domestic_etf/crypto/etc), `principal`, `principal_usd`(해외종목 달러 원금 — 국내종목은 null), `current_value`, `purchase_date`

### 자산 — Subscription / Asset / NetWorthSnapshot

- `Subscription` — `cycle`(monthly/yearly/weekly), `status`(active/trial/paused), `next_payment_date`, `last_used_at`
- `Asset` — `type`(cash/savings/investment/realestate/debt/etc), `amount`, `interest_rate?` — debt 는 순자산에서 차감
- `NetWorthSnapshot` — `month`(YYYY-MM), `total_assets`, `total_debt` (`@@unique([user_id, month])`)

### 설정 — UserSettings (1:1)

- 알림: `notif_monthly`·`notif_upload`·`notif_maturity`·`notif_deadline`
- 보안: `session_expiry`, `pw_auto_hide`, `master_lock_enabled`·`master_lock_hash`(scrypt)·`master_lock_timeout`
- API: `openai_api_key`, `openai_model`
- JSON: `categories`[{emoji,name}], `widgets`[{id,on}](순서=표시순서), `menu_order`(사이드바 1차 메뉴 순서)

### 보관함 — IdentityCard / Credential / EnvProject / EnvVar / EnvVarHistory

- `IdentityCard` — `type`(passport/idcard/license/cert/etc), `number_enc`, `file_id`(StorageFile FK, 사본 이미지), `issue/expire_date`
- `Credential` — `category`, `username`, `password_enc`, `totp_enc?`, `backup_codes_enc?`(JSON 배열 암호문), `password_changed_at`(90일 회전 알림용)
- `EnvProject` — `name`, `description`
- `EnvVar` — `env`(dev/staging/prod), `group`, `key`, `value_enc`
- `EnvVarHistory` — `value_enc` 변경 시 이전값 1건 적재(변수당 20건 유지) → diff/롤백

### 파일 보관함 — StorageFolder / StorageFile

- `StorageFolder` — `parent_id` 자기참조로 무한 중첩
- `StorageFile` — `object_key`(B2: `users/{userId}/{uuid}/{filename}`), `size`, `mime_type`, `hash`(SHA-256, 중복제거). soft delete 시 같은 object_key 참조 없을 때만 B2 삭제

### 보안 — SecurityRisk / LoginSession / AccessLog / SecurityScoreSnapshot

- `SecurityRisk` — `category`(reuse/weak/no2fa/breach), `severity`, `resolved` (실시간 분석은 별도, 이 테이블은 시드/표시용)
- `LoginSession` — `device`, `device_type`, `location`, `is_current`, `status`, `revoked_at` (새 기기 로그인 감지 시 기록)
- `AccessLog` — `action`(cred_reveal/cred_totp/cred_backup/identity_reveal/env_reveal/backup_codes_generate/vault_unlock/vault_disable/session_revoke/data_export), `target_type`(credential/identity/env/security/account), `target_id/name`, `ip`, `user_agent`
- `SecurityScoreSnapshot` — `date`(YYYY-MM-DD), `score`, `reuse/weak/no2fa` — 크론이 매일 1건 적재 → 추이 차트

### 카테고리 — Category

- 도메인별(`domain`) 사용자 정의 카테고리. `@@unique([user_id, domain, code])`
- 가계부(`transaction`)는 **2계층**: 대분류(`parent_code` NULL) → 소분류(`parent_code`=대분류 code)
- 거래(`Transaction.category`)는 **소분류 code** 만 저장 — 대분류는 `parent_code` 로 파생
- 그 외 도메인(결제수단·구독·자산 등)은 단일 계층(`parent_code` NULL)
- 엑셀→앱 카테고리 매칭·마이그레이션: [category-migration.md](category-migration.md)

### 인증 — RefreshToken

- access 토큰은 클라이언트 메모리에만 보관(localStorage 미사용), refresh 토큰은 httpOnly 쿠키 + `RefreshToken` 화이트리스트(`jti`)로 관리
- `/auth/refresh` 호출 시 rotation: 기존 `jti` 폐기(`revoked_at`) + 신규 발급
- `/auth/logout`, 세션 단건/전체 차단(`SecurityService.revokeSession/revokeAll`) 시 연결된 `RefreshToken` 도 함께 폐기

### 시스템 로그 — SystemLog

- `level`(info/warn/error), `category`(recurring_buy/recurring_tx/cron/asset/file/security/ai), `message`, `metadata`(JSON, 선택)
- `user_id` 는 FK 관계 없이 참조용 int만 저장(전체 사용자 집계 이벤트는 null) — 사용자 삭제 시 별도 정리 불필요
- 기록: `SystemLogService.info/warn/error`(fire-and-forget, 실패해도 호출부에 영향 없음) · 조회: `/system-logs` (`/logs` 화면)
- 90일 경과 항목은 `trash-cron.service.ts`가 매일 정리

## 타임스탬프

TiDB Cloud(프로덕션)는 트리거를 지원하지 않아 BEFORE INSERT/UPDATE 트리거 기반 KST 강제 방식은 제거됨. `created_at`/`updated_at`은 Prisma `@default(now())`/`@updatedAt` 그대로 사용(UTC 기준).
