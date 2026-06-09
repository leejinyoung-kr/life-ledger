# DocNexus — ERD

> 단일 소스: `backend/prisma/schema.prisma` · DB: MariaDB(utf8mb4_unicode_ci)
> 마이그레이션: `20260610000000_init_consolidated`(전 도메인 통합) + `20260610010000_phase17a_security_core` · `20260610020000_phase17b_dataflow` · `20260610030000_phase17c_enhance` · `20260610040000_phase17d_extras`

## 테이블 목록 (27)

| 테이블 | 설명 |
| --- | --- |
| User | 사용자 (Google OAuth) |
| Transaction | 수입/지출 내역 (반복 자동생성 포함) |
| Saving | 예적금 |
| Investment | 투자 |
| Subscription | 구독 서비스 |
| Asset | 자산/부채 항목 |
| NetWorthSnapshot | 순자산 월별 스냅샷 |
| UserSettings | 사용자 설정 (1:1) |
| Notification | 알림 |
| Task | 할 일 |
| Goal | 목표 |
| Note | 메모 |
| CalendarEvent | 캘린더 일정 |
| SecurityRisk | 보안 위험 (시드/표시용) |
| LoginSession | 로그인 세션 |
| Category | 카테고리 (도메인별) |
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

## 주요 관계

```text
User 1 ─── N (Transaction, Saving, Investment, Subscription, Asset, NetWorthSnapshot,
              Notification, Task, Goal, Note, CalendarEvent,
              SecurityRisk, LoginSession, Category, IdentityCard, Credential,
              EnvProject, EnvVar, StorageFolder, StorageFile, AccessLog, SecurityScoreSnapshot, AiReport)
User 1 ─── 1 UserSettings
EnvProject     1 ─── N EnvVar
EnvVar         1 ─── N EnvVarHistory
StorageFolder  1 ─── N StorageFolder(parent_id, 자기참조) · N StorageFile
StorageFile    1 ─── N IdentityCard(file_id, 사본 이미지)
```

## 암호화 (보관함)

민감 필드는 AES-256-GCM 암호문(`v1:ivHex:tagHex:cipherHex`)으로 저장. 목록은 마스킹, 원문은 reveal 엔드포인트로만 제공.
키는 `CREDENTIAL_SECRET` 을 sha256 한 32바이트. 마스터 잠금 비번은 별도 scrypt 해시(`saltHex:hashHex`).

- `IdentityCard.number_enc` · `Credential.password_enc`·`totp_enc`·`backup_codes_enc` · `EnvVar.value_enc` · `EnvVarHistory.value_enc`

## 도메인별 요약

### 가계부 — Transaction / Saving / Investment

- `Transaction` — `type`(income/expense/transfer), `category`, `amount`, `pay_method`, `is_recurring`, `recurring_rule`(JSON), 반복 회차(`recurring_parent_id`·`recurring_period`·`recurring_overridden`), soft delete
- `Saving` — `type`(savings/deposit/subscription/etc), `interest_rate`, `monthly_amount`, `maturity_date`, `balance`
- `Investment` — `type`(domestic_stock/foreign_stock/foreign_etf/domestic_etf/crypto/etc), `principal`, `current_value`, `purchase_date`

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
- `AccessLog` — `action`(cred_reveal/cred_totp/cred_backup/identity_reveal/env_reveal), `target_type/id/name`, `ip`, `user_agent`
- `SecurityScoreSnapshot` — `date`(YYYY-MM-DD), `score`, `reuse/weak/no2fa` — 크론이 매일 1건 적재 → 추이 차트

## KST 타임스탬프

Prisma 가 `@default(now())`/`@updatedAt` 을 UTC 로 전송 → BEFORE INSERT/UPDATE 트리거로 NOW() 덮어씀 (전제: `@@global.time_zone = +09:00`). 신규 테이블은 마이그레이션에 트리거 동봉.
