# LifeLedger — 인덱스 설계 근거

> **AI 초안 — 2026-10-18. 판정은 본인이 EXPLAIN 으로 확인한 뒤 확정.**
> 근거는 "당시 왜 만들었나"가 아니라 **지금 코드에서 그 인덱스를 쓰는 쿼리**다. 설계 의도를 기록한 문서는 없고, 확인되는 사실은 schema 주석 · 마이그레이션 · 커밋 메시지뿐이다.
> 단일 소스: [`backend/prisma/schema.prisma`](../backend/prisma/schema.prisma) · 인덱스 이름은 마이그레이션 SQL 기준(Prisma 기본 이름 `<테이블>_<컬럼>_idx` · `_key`).

## 읽는 법

- **Prisma 호출 → SQL 조건**: `findMany({ where: { user_id, deleted_at: null }, orderBy: { date: 'desc' } })` 는 `WHERE user_id = ? AND deleted_at IS NULL ORDER BY date DESC` 로 푼다. `contains` 는 `LIKE '%..%'`(인덱스로 못 좁힘), `in` 은 `IN (...)`.
- **복합 인덱스 규칙**: B-tree 는 왼쪽 컬럼부터 쓴다. **등호(`=`, `IS NULL`) 컬럼이 앞, 범위(`<` `>=` `BETWEEN`) · 정렬 컬럼이 뒤**여야 끝까지 탄다. 범위 조건을 만난 다음 컬럼은 찾는 데 못 쓴다(걸러내기만).
- InnoDB 보조 인덱스는 끝에 PK(`id`)를 몰래 달고 있다 — `(user_id, date)` 는 사실상 `(user_id, date, id)` 라서 `ORDER BY date DESC, id DESC` 까지 정렬 없이 나온다.
- **FK 컬럼에는 인덱스가 있어야 한다** (InnoDB 규칙). `user_id` 단독 인덱스 대부분은 조회용이자 FK(`ON DELETE CASCADE`) 용이다. 지우려면 **같은 컬럼이 맨 왼쪽인 다른 인덱스가 있어야** 하고, 없으면 MariaDB 가 FK 인덱스를 다시 만든다.
- 판정: **필요** / **중복 후보**(다른 인덱스의 왼쪽 접두사와 겹침) / **일부 미사용**(앞 컬럼만 쓰임) / **효과 의심**(쓰는 쿼리는 있으나 선택도가 낮아 옵티마이저가 안 고를 가능성) / **쓰는 쿼리를 못 찾음 — 불필요 후보**.
- 줄 번호는 `backend/src/` 기준, 2026-10-18 develop.

## 요약

| 구분 | 개수 | 대상 |
| --- | --- | --- |
| 전체 (`@id` 제외) | 47 | `@@index` 37 · `@@unique` 3 · `@unique` 7 |
| 중복 후보 | 3 | `net_worth_snapshot(user_id)` · `category(domain)` · `storage_file(user_id)` |
| 일부 미사용 (뒤 컬럼을 쓰는 쿼리 없음) | 2 | `notification(user_id, created_at)` · `job_run(job, started_at)` |
| 효과 의심 | 2 | `system_log(level)` · `system_log(category)` |
| 앱 쿼리 없음 (FK 전용) | 1 | `refresh_token(user_id)` — 계정 삭제 cascade 때만 쓰인다 |
| 쓰는 쿼리를 못 찾음 — 불필요 후보 | 0 | — |
| **인덱스가 없는 쿼리** (반대 방향) | 2 | `storage_file.object_key` 조회 · `email_login_code` 의 `created_at` 범위/정렬 |

## 1. 가계부 · 자산

### transaction

| 인덱스 | 쓰는 쿼리 (파일:줄 → SQL 조건) | 판정 |
| --- | --- | --- |
| `transaction_user_id_date_idx` `(user_id, date)` | 가계부 목록 `transaction/transaction.service.ts:250` · 내보내기 커서 `:484` → `user_id = ? AND deleted_at IS NULL [AND date BETWEEN ? AND ?] [AND type = ?] ORDER BY date DESC, id DESC LIMIT ?` ／ 최근 거래 월 `:207` → `user_id = ? AND deleted_at IS NULL ORDER BY date DESC LIMIT 1` ／ 대시보드 최근 5건 `dashboard/dashboard.service.ts:44` · 통합 검색 `search/search.service.ts:24`(제목 `LIKE` 는 거름만) | **필요** — 등호 `user_id` 다음이 범위·정렬 `date` 라 순서가 맞다. `deleted_at` 은 인덱스에 없어 행을 읽은 뒤 거른다 |
| `transaction_recurring_schedule_id_idx` `(recurring_schedule_id)` | 반복 회차 생성 `transaction/transaction.service.ts:161` → `user_id = ? AND recurring_schedule_id = ?` ／ FK `ON DELETE SET NULL`(자동이체 설정 삭제 시) | **필요** (조회 + FK) |
| `transaction_user_id_type_deleted_at_date_amount_idx` `(user_id, type, deleted_at, date, amount)` | 월별 지출 추이 `transaction/transaction.service.ts:306` → `user_id = ? AND deleted_at IS NULL AND type = 'expense' AND date >= ? AND date < ?` 의 `SUM(amount)` ／ 현금 합계 `asset/asset.service.ts:27` → `user_id = ? AND deleted_at IS NULL [AND date >= ?] GROUP BY type` 의 `SUM(amount)` ／ 대시보드 이번 달 `dashboard/dashboard.service.ts:32` · 월 요약 `transaction.service.ts:273` · 목록 합계 `:235` — 모두 `GROUP BY type` | **필요** — 아래 「복합 인덱스 순서」 참고. 월별 추이에는 딱 맞고, `GROUP BY type` 쿼리에서는 `date` 로 좁히지 못한다는 가설을 EXPLAIN ③ 으로 확인 |

이 인덱스의 이력 (커밋 메시지 그대로): `301e11d` 2026-08-10 "[perf] 대시보드/자산 요약 조회 속도 개선" 에서 `(user_id, type, deleted_at)` → `54218e5` 2026-08-18 "[perf] 자산 요약 API 현금 총액 계산 성능 개선" 에서 `amount` 를 붙였다가 같은 커밋 안에서 `date` 를 넣은 지금 모양으로 바꿨다. schema 주석은 "cashTotal 델타 집계가 date 구간으로 좁혀 스캔되며 … 커버링 인덱스" 라고 적혀 있다.

### transaction_favorite · saving · investment_account · investment · recurring_schedule · subscription

| 인덱스 | 쓰는 쿼리 | 판정 |
| --- | --- | --- |
| `transaction_favorite_user_id_sort_order_idx` `(user_id, sort_order)` | 목록 `transaction-favorite/transaction-favorite.service.ts:29` → `user_id = ? ORDER BY sort_order, id` ／ 맨 뒤 순서 `:45` → `user_id = ? ORDER BY sort_order DESC LIMIT 1` | **필요** — 등호 + 정렬, 순서가 맞다 |
| `saving_user_id_idx` `(user_id)` | 목록 `saving/saving.service.ts:44` · 자산 요약 `asset/asset.service.ts:47` · 만기 알림 `maintenance/notification-cron.service.ts:58`(`maturity_date IN (...)`) · D-day `dashboard/dashboard.service.ts:122` → 전부 `user_id = ? AND deleted_at IS NULL [AND maturity_date ...]` | **필요** (조회 + FK) |
| `investment_account_user_id_idx` `(user_id)` | 목록 `investment-account/investment-account.service.ts:90` · 자산 요약 `asset/asset.service.ts:55` · 캘린더 가상 일정 `calendar/calendar.service.ts:269` → `user_id = ? AND deleted_at IS NULL` | **필요** (조회 + FK) |
| `investment_user_id_idx` `(user_id)` | 목록 `investment/investment.service.ts:297` · 현재가 갱신 `:97` · 자산 요약 `asset/asset.service.ts:51` → `user_id = ? AND deleted_at IS NULL [AND type ...]` | **필요** (조회 + FK) |
| `investment_account_id_idx` `(account_id)` | 계좌 삭제 전 보유 확인 `investment-account/investment-account.service.ts:198` → `account_id = ? AND deleted_at IS NULL` ／ 계좌별 집계 `:67` → `user_id = ? AND account_id IN (...)` | **필요** (조회 + FK cascade) |
| `recurring_schedule_user_id_idx` `(user_id)` | 목록 `recurring-schedule/recurring-schedule.service.ts:75` · 반복거래 `transaction/transaction.service.ts:150` · 반복매수 `investment/investment.service.ts:154` · 현금흐름 예측 `dashboard/dashboard.service.ts:79` → `user_id = ? AND deleted_at IS NULL AND kind = ? [AND active = 1]` | **필요** (조회 + FK) |
| `recurring_schedule_investment_id_idx` `(investment_id)` | 직접 `WHERE investment_id = ?` 는 없다. 반복매수의 관계 필터 `investment/investment.service.ts:154` 는 `investment.id` (PK) 쪽으로 조인 ／ FK `ON DELETE CASCADE` — 휴지통 영구삭제 `maintenance/trash-cron.service.ts:24` 가 투자를 지울 때 | **필요** (FK 용 — 조회용 근거는 약함) |
| `subscription_user_id_idx` `(user_id)` | 목록 `subscription/subscription.service.ts:63` · 대시보드 `dashboard/dashboard.service.ts:39`·`:76`·`:124` · 결제 알림 `maintenance/notification-cron.service.ts:83` · 캘린더 `calendar/calendar.service.ts:253` | **필요** (조회 + FK) |

### net_worth_snapshot

| 인덱스 | 쓰는 쿼리 | 판정 |
| --- | --- | --- |
| `net_worth_snapshot_user_id_month_key` UNIQUE `(user_id, month)` | 월말 스냅샷 저장 `maintenance/net-worth-snapshot-cron.service.ts:37` → `upsert where user_id_month` (같은 달 두 번 저장 방지) ／ 직전 월말 `asset/asset.service.ts:59` → `user_id = ? AND month < ? ORDER BY month DESC LIMIT 1` ／ 추이 `asset/asset.service.ts:133` → 같은 조건 `LIMIT 5` | **필요** — 등호 + 범위·정렬이 같은 컬럼, 순서가 맞다 |
| `net_worth_snapshot_user_id_idx` `(user_id)` | `user_id` 만 쓰는 쿼리(계정 삭제 `auth/auth.service.ts:393`)도 위 UNIQUE 의 왼쪽 접두사로 탄다. FK 도 위 UNIQUE 가 만족한다 | **중복 후보** |

## 2. 일정 · 알림 · 공휴일 · 카테고리

| 인덱스 | 쓰는 쿼리 | 판정 |
| --- | --- | --- |
| `calendar_event_user_id_date_idx` `(user_id, date)` | 다가오는 일정 `dashboard/dashboard.service.ts:49` → `user_id = ? AND deleted_at IS NULL AND date >= ? ORDER BY date LIMIT 4` ／ 월 목록 `calendar/calendar.service.ts:342` → `user_id = ? AND deleted_at IS NULL AND (반복없음 AND date 범위 OR 반복 AND date < ? AND (recur_until IS NULL OR recur_until >= ?)) ORDER BY date, id` ／ 다가오는 일정(캘린더) `:380` | **필요** — 대시보드 쿼리에는 딱 맞다. 월 목록은 `OR` 라 `user_id` 까지만 좁힐 가능성 (데이터가 적어 문제는 아님) |
| `notification_user_id_created_at_idx` `(user_id, created_at)` | 목록 `notification/notification.service.ts:71` → `user_id = ? [AND group = ?] ORDER BY occurred_at DESC LIMIT ?` — **정렬이 `created_at` 이 아니라 `occurred_at`** ／ 안 읽은 수 `:58` → `user_id = ? AND read_at IS NULL` · 전체 읽음 `:93` · 중복 알림 확인 `maintenance/notification-cron.service.ts:36` → `user_id = ? AND title = ? AND read_at IS NULL` | **일부 미사용** — `user_id` 만 쓰이고 `created_at` 으로 정렬·범위를 거는 쿼리가 없다. 목록은 filesort 예상(EXPLAIN ④). `(user_id, occurred_at)` 으로 바꾸는 후보 |
| `holiday_date_name_key` UNIQUE `(date, name)` | 공휴일 캐싱 `holiday/holiday.service.ts:50` → `createMany(skipDuplicates)` = `INSERT IGNORE` — 같은 날·같은 이름 중복 저장을 이 UNIQUE 가 막는다 | **필요** (중복 방지 규칙 자체) |
| `holiday_year_idx` `(year)` | 연도별 조회 `holiday/holiday.service.ts:36` → `year = ?` | **필요** |
| `category_domain_code_key` UNIQUE `(domain, code)` | 추가 전 중복 확인 `category/category.service.ts:140` · 시드 `:200` → `domain = ? AND code = ?` | **필요** |
| `category_domain_idx` `(domain)` | 도메인 목록 `category/category.service.ts:130` · 엑셀 라벨 매핑 `transaction/transaction.service.ts:382`·`:450`~`:460` → `domain = ?` — 위 UNIQUE 와 아래 인덱스의 왼쪽 접두사로 탄다 | **중복 후보** |
| `category_domain_parent_code_idx` `(domain, parent_code)` | 엑셀 가져오기 소분류 `transaction/transaction.service.ts:376` → `domain = 'transaction' AND parent_code IS NOT NULL` | **필요** (등호 + 범위, 순서 맞음). 다만 표가 작아(수십~수백 행) 체감 차이는 거의 없다 |

## 3. 인증 · 보안

| 인덱스 | 쓰는 쿼리 | 판정 |
| --- | --- | --- |
| `user_google_id_key` UNIQUE `(google_id)` | 구글 로그인 `auth/auth.service.ts:153` → `upsert where google_id` | **필요** (한 구글 계정 = 한 사용자) |
| `user_email_key` UNIQUE `(email)` | 이메일 코드 로그인 `auth/auth.service.ts:270` · 데모 `:132` · 개발 `:143` → `upsert where email` | **필요** |
| `user_settings_user_id_key` UNIQUE `(user_id)` | `settings/settings.service.ts:14` · `security/vault.service.ts:44` · `maintenance/notification-cron.service.ts:52` 등 → `findUnique where user_id` (1:1) | **필요** |
| `login_session_user_id_idx` `(user_id)` | 로그인 기록 `auth/auth.service.ts:283`·`:284`·`:289` → `user_id = ? AND revoked_at IS NULL [AND device = ? AND location = ?]` ／ 세션 목록 `security/security.service.ts:28` → `... ORDER BY is_current DESC, last_active_at DESC` | **필요** (조회 + FK) |
| `refresh_token_jti_key` UNIQUE `(jti)` | 토큰 갱신 `auth/auth.service.ts:333` · 로그아웃 `:368`·`:372` · 푸시 세션 확인 `push/push.service.ts:39` → `jti = ?` | **필요** (화이트리스트 키) |
| `refresh_token_user_id_idx` `(user_id)` | 앱 코드에 `refresh_token.user_id` 로 거는 쿼리 없음. `user` 삭제(`auth/auth.service.ts:399`) 때 FK `ON DELETE CASCADE` 가 쓴다 | **앱 쿼리 없음 (FK 전용)** — 지워도 MariaDB 가 FK 인덱스를 다시 만든다 |
| `refresh_token_session_id_idx` `(session_id)` | 세션 강제 로그아웃 `security/security.service.ts:44`·`:63` → `session_id [IN] ? AND revoked_at IS NULL` · FK `SET NULL` | **필요** |
| `email_login_code_email_idx` `(email)` | 발급 상한 `auth/auth.service.ts:224`·`:225` → `email = ? AND created_at >= ?` 의 `COUNT` ／ 최신 코드 `:241` → `email = ? AND consumed_at IS NULL ORDER BY created_at DESC LIMIT 1` ／ 이전 코드 무효화 `:195` | **필요** — 다만 `created_at` 범위 · 정렬은 인덱스 밖. 이 표는 지우는 작업이 없어 계속 쌓인다 → `(email, created_at)` 후보 |
| `access_log_user_id_created_at_idx` `(user_id, created_at)` | 최근 열람 `access-log/access-log.service.ts:45` → `user_id = ? ORDER BY created_at DESC LIMIT ?` | **필요** — 등호 + 정렬, 순서가 맞다 |
| `push_subscription_endpoint_key` UNIQUE `(endpoint)` | 구독 저장 `push/push.service.ts:62`·`:68` → `findUnique` · `upsert where endpoint` (남의 endpoint 덮어쓰기 방지 검사 포함) | **필요** |
| `push_subscription_user_id_idx` `(user_id)` | 발송 `push/webpush.channel.ts:70` · 테스트 발송 `push/push.service.ts:97` · 해제 `:90` → `user_id = ? [AND endpoint = ?]` | **필요** |
| `push_subscription_session_id_idx` `(session_id)` | 로그아웃 `auth/auth.service.ts:378` · 세션 차단 `security/security.service.ts:48`·`:67` → `session_id [IN] ?` · FK cascade | **필요** |

## 4. 보관함 (계정 · 파일)

| 인덱스 | 쓰는 쿼리 | 판정 |
| --- | --- | --- |
| `credential_user_id_idx` `(user_id)` | 목록 `credential/credential.service.ts:81` → `user_id = ? AND deleted_at IS NULL ORDER BY updated_at DESC` · 2FA 없는 수 `:84` · 비번 회전 알림 `maintenance/notification-cron.service.ts:101` · 검색 `search/search.service.ts:29` | **필요** (조회 + FK). 목록 정렬 `updated_at` 은 인덱스 밖(filesort) — 계정 수가 적어 문제는 아님 |
| `storage_folder_user_id_idx` `(user_id)` | 폴더 전체 `file/file.service.ts:91`·`:143`·`:456` → `user_id = ? AND deleted_at IS NULL` | **필요** (조회 + FK) |
| `storage_folder_parent_id_idx` `(parent_id)` | 폴더 목록 `file/file.service.ts:47` · 하위 폴더 BFS `:525` · 폴더째 업로드 `:410` → `user_id = ? AND parent_id = ? AND deleted_at IS NULL` · 하위 폴더 수 `_count`(`:50`) · FK `SET NULL` | **필요** |
| `storage_file_user_id_idx` `(user_id)` | 사용량 `file/file.service.ts:56`·`:240` → `user_id = ? AND deleted_at IS NULL` 의 `SUM(size)` 등 — 아래 `(user_id, hash)` 의 왼쪽 접두사로도 탄다. FK 도 그쪽이 만족 | **중복 후보** |
| `storage_file_folder_id_idx` `(folder_id)` | 파일 목록 `file/file.service.ts:52` → `user_id = ? AND folder_id = ? AND deleted_at IS NULL ORDER BY created_at DESC` ／ 폴더별 파일 수 `:107` · 폴더 삭제 `:535` → `folder_id IN (...)` · FK `SET NULL` | **필요** |
| `storage_file_user_id_hash_idx` `(user_id, hash)` | 중복 업로드 확인 `file/file.service.ts:262` → `user_id = ? AND hash = ? AND deleted_at IS NULL` | **필요** — 등호 둘, 순서 무관하게 맞다 |

## 5. 운영 (예약 작업 · 알림 발송 · 로그)

| 인덱스 | 쓰는 쿼리 | 판정 |
| --- | --- | --- |
| `job_run_running_key_key` UNIQUE `(running_key)` | 작업 시작 `maintenance/job-run.store.ts:27` → `INSERT` 가 같은 작업 이름으로 충돌하면(P2002) "이미 실행 중" | **필요** — 동시 실행 방지 규칙 자체가 이 UNIQUE 다 |
| `job_run_job_started_at_idx` `(job, started_at)` | `/_meta` 작업 상태 `meta/jobs.meta.ts:46`·`:51` → `job = ? [AND status = 'succeeded'] ORDER BY id DESC LIMIT 1` — **정렬이 `started_at` 이 아니라 `id`** ／ 90일 정리 `maintenance/trash-cron.service.ts:43` → `started_at < ? AND status <> 'running'` — `job` 조건이 없어 이 인덱스를 못 탄다 | **일부 미사용** — `job` 만 쓰인다. `(job, started_at, id)` 순서라 `ORDER BY id` 는 정렬이 따로 돈다(90일치라 작음). 코드 주석(`jobs.meta.ts:43`)은 "(job, started_at) 인덱스가 있다" 고 적혀 있다 |
| `job_run_status_lease_until_idx` `(status, lease_until)` | lease 만료 찾기 `maintenance/job-run.store.ts:68` → `status = 'running' AND lease_until < ?` | **필요** — 등호 + 범위, 순서가 맞다 |
| `outbox_message_idempotency_key_key` UNIQUE `(idempotency_key)` | 적재 `push/outbox.store.ts:28` → 같은 `noti:<알림 id>` 면 충돌(P2002) → 중복 발송 방지 | **필요** (멱등성 규칙 자체) |
| `outbox_message_status_available_at_idx` `(status, available_at)` | 선점 후보 `push/outbox.store.ts:48` → `status = 'pending' AND available_at <= ? ORDER BY available_at LIMIT ?` ／ `/_meta` 가장 오래 밀린 대기 `meta/outbox.meta.ts:28` · 상태별 수 `:24` · 선점 만료 `push/outbox.store.ts:120`·`meta/outbox.meta.ts:44` → `status = 'sending' AND claimed_until < ?`(앞 컬럼만) | **필요** — 디스패처 쿼리에 딱 맞다 |
| `system_log_user_id_idx` `(user_id)` | 로그 조회 `system-log/system-log.service.ts:69` → `(user_id = ? OR user_id IS NULL) [AND level = ?] [AND category = ?] [AND created_at BETWEEN ? AND ?] ORDER BY created_at DESC LIMIT ?` — `ref_or_null` 로 탈 수 있다 | **필요** |
| `system_log_created_at_idx` `(created_at)` | 같은 조회의 정렬 · 기간 · 90일 정리 `maintenance/trash-cron.service.ts:38` → `created_at < ?` | **필요** |
| `system_log_level_idx` `(level)` | 같은 조회의 선택 필터 `level = ?` — 값이 info · warn · error 3개뿐 | **효과 의심** — 선택도가 낮아 옵티마이저가 거의 안 고를 것. EXPLAIN 으로 `possible_keys` 에만 뜨는지 확인 |
| `system_log_category_idx` `(category)` | 같은 조회의 선택 필터 `category = ?` — 값이 10개 안팎 | **효과 의심** — 위와 같음 |

## 6. 인덱스가 없는 쿼리 (반대 방향 점검)

인덱스가 "남는" 것만이 아니라 "없어서 전체를 읽는" 쿼리도 같이 본다.

| 쿼리 | SQL 조건 | 현재 | 판단 |
| --- | --- | --- | --- |
| 파일 삭제 뒤 B2 오브젝트를 다른 파일이 쓰는지 `file/file.service.ts:379`·`:500` | `object_key = ? AND deleted_at IS NULL` (`user_id` 없음) | `object_key` 인덱스 없음 → 파일 삭제마다 `storage_file` 전체 스캔 | 후보 — `(object_key)` 추가 또는 조건에 `user_id` 를 넣어 `(user_id, …)` 를 타게. 오브젝트 키에 `users/{userId}/` 가 들어 있어 같은 사용자 안에서만 겹친다 |
| 이메일 코드 발급 상한 · 최신 코드 `auth/auth.service.ts:224`·`:241` | `email = ? AND created_at >= ?` / `ORDER BY created_at DESC` | `email` 로 좁힌 뒤 거름·정렬 | 후보 — `(email, created_at)`. 행을 지우는 작업이 없어 쌓이는 표다 |
| 휴지통 영구삭제 `maintenance/trash-cron.service.ts:22`~`:27` | `deleted_at < ?` (6개 표, `user_id` 없음) | 전체 스캔 | 하루 1번 · 개인 데이터라 그대로 둬도 된다 |
| 구독 결제일 넘기기 `maintenance/subscription-cron.service.ts:16` | `deleted_at IS NULL AND status <> 'paused' AND next_payment_date < ?` | 전체 스캔 | 하루 1번 — 그대로 |
| 암호문 점검 · 재암호화 `crypto/cipher-store.ts:34` | `<암호문 컬럼> IS NOT NULL ORDER BY id` (raw SQL) | 전체 스캔 (의도된 전수 검사) | 그대로 |

## 7. 복합 인덱스 컬럼 순서 점검

| 인덱스 | 쿼리 조건의 모양 | 순서가 맞나 |
| --- | --- | --- |
| `transaction (user_id, date)` | `user_id =` → `date` 범위 · 정렬 | 맞음 |
| `transaction (user_id, type, deleted_at, date, amount)` | 월별 추이: `user_id =` · `type =` · `deleted_at IS NULL` → `date` 범위, `amount` 는 읽기만 | **맞음 + 커버링** (표를 안 읽고 인덱스만으로 합산) |
| 〃 | 현금 합계·월 요약·대시보드: `user_id =` · `deleted_at IS NULL` · `date` 범위 · `GROUP BY type` — **`type` 등호가 없다** | **일부만** — B-tree 규칙상 `type` 이 비면 그 뒤 `deleted_at` · `date` 로는 찾지 못하고 `user_id` 구간을 전부 훑으며 거른다. 대신 커버링이라 표를 안 읽고, `GROUP BY type` 이 인덱스 순서 그대로라 임시 테이블이 필요 없다. schema 주석의 "date 구간으로 좁혀 스캔" 이 실제로 일어나는지는 EXPLAIN ③ 의 `key_len`(4 면 `user_id` 만) 으로 확인 |
| `net_worth_snapshot (user_id, month)` | `user_id =` → `month <` 범위 · 내림차순 정렬 | 맞음 |
| `transaction_favorite (user_id, sort_order)` | `user_id =` → 정렬 | 맞음 |
| `calendar_event (user_id, date)` | `user_id =` → `date >=` · 정렬 (대시보드) / `OR` 섞임 (월 목록) | 대시보드 맞음, 월 목록은 `user_id` 까지 |
| `notification (user_id, created_at)` | `user_id =` → **`occurred_at`** 정렬 | **안 맞음** — 정렬 컬럼이 다르다 |
| `access_log (user_id, created_at)` | `user_id =` → `created_at` 정렬 | 맞음 |
| `category (domain, parent_code)` | `domain =` → `parent_code IS NOT NULL` | 맞음 |
| `storage_file (user_id, hash)` | 등호 둘 | 맞음 |
| `job_run (job, started_at)` | `job =` → **`id`** 정렬 | **안 맞음** — `started_at` 을 쓰는 쿼리가 없다 |
| `job_run (status, lease_until)` | `status =` → `lease_until <` | 맞음 |
| `outbox_message (status, available_at)` | `status =` → `available_at <=` · 정렬 | 맞음 |

## 8. EXPLAIN 해 볼 쿼리

HeidiSQL 에서 데이터베이스 `lifeledger` 를 고르고 붙여 넣는다. `user_id = 1` 은 실제 데이터가 있는 본인 id 로 바꾼다. 데이터가 적으면 옵티마이저가 인덱스 대신 전체 스캔을 고를 수 있다 — 그때는 결과에 행 수(`SELECT COUNT(*)`)를 같이 적는다.

먼저 실제로 있는 인덱스를 확인한다.

```sql
SHOW INDEX FROM `transaction`;
SHOW INDEX FROM notification;
SHOW INDEX FROM storage_file;
```

### ① 가계부 목록 (한 달 · 첫 페이지)

`transaction/transaction.service.ts:250` — 가계부 화면을 열 때마다 돈다.

```sql
EXPLAIN
SELECT * FROM `transaction`
WHERE user_id = 1 AND deleted_at IS NULL
  AND date >= '2026-10-01' AND date <= '2026-10-31'
ORDER BY date DESC, id DESC
LIMIT 20 OFFSET 0;
```

- 예상: `key = transaction_user_id_date_idx`, `type = range`, `Extra` 에 `Using filesort` 가 **없다** (`date, id` 순서가 인덱스 순서와 같음). `Using where` 는 `deleted_at` 거름.
- 결과: _HeidiSQL 에서 돌린 뒤 채움_

### ② 월별 지출 추이 + 인덱스를 못 타게 바꾼 비교

`transaction/transaction.service.ts:306` — 가계부 요약 차트, 5개월치를 한 달씩 5번 돈다.

```sql
-- 원래 쿼리
EXPLAIN
SELECT SUM(amount) FROM `transaction`
WHERE user_id = 1 AND deleted_at IS NULL AND type = 'expense'
  AND date >= '2026-10-01' AND date < '2026-11-01';

-- 비교 A: 날짜를 함수로 감싼다 → date 로 찾을 수 없다
EXPLAIN
SELECT SUM(amount) FROM `transaction`
WHERE user_id = 1 AND deleted_at IS NULL AND type = 'expense'
  AND DATE_FORMAT(date, '%Y-%m') = '2026-10';

-- 비교 B: 왼쪽 접두사(user_id)를 뺀다 → 이 인덱스의 첫 컬럼이 비어 찾을 수 없다
EXPLAIN
SELECT SUM(amount) FROM `transaction`
WHERE deleted_at IS NULL AND type = 'expense'
  AND date >= '2026-10-01' AND date < '2026-11-01';
```

- 예상 (원래): `key = transaction_user_id_type_deleted_at_date_amount_idx`, `type = range`, `Extra = Using where; Using index` (커버링 — 표를 안 읽음), `key_len` 이 4개 컬럼(user_id · type · deleted_at · date)을 다 쓴 길이.
- 예상 (비교 A): 같은 인덱스를 `type = ref` 로 타지만 `key_len` 이 짧아진다(앞 3개만) — 그 사용자의 지출 전체를 훑는다. `rows` 가 원래보다 크다.
- 예상 (비교 B): `type = ALL`(전체 스캔) 또는 `type = index`(인덱스 전체 훑기). `rows` ≈ 표 전체 행 수.
- 결과 (원래): _HeidiSQL 에서 돌린 뒤 채움_
- 결과 (비교 A): _HeidiSQL 에서 돌린 뒤 채움_
- 결과 (비교 B): _HeidiSQL 에서 돌린 뒤 채움_

### ③ 자산 요약의 현금 델타 (`GROUP BY type`)

`asset/asset.service.ts:27` — 대시보드 · 자산 화면을 열 때마다 돈다. 직전 월말 스냅샷 이후 거래만 더한다.

```sql
EXPLAIN
SELECT type, SUM(amount) FROM `transaction`
WHERE user_id = 1 AND deleted_at IS NULL AND date >= '2026-10-01'
GROUP BY type;
```

- 예상: `key = transaction_user_id_type_deleted_at_date_amount_idx`, `type = ref`, `ref = const`, `Extra = Using where; Using index`, **`key_len = 4`(user_id 만)** — `type` 등호가 없어 `date` 로는 못 좁힌다는 가설. `Using temporary` 는 없을 것(인덱스 순서가 이미 `type` 순).
- 확인할 것: `key_len` 이 4 보다 크면 가설이 틀린 것 — 그 경우 schema 주석이 맞다. `transaction_user_id_date_idx` 를 골랐다면 `Using index` 가 빠지고(표를 읽음) `Using temporary` 가 붙는다.
- 결과: _HeidiSQL 에서 돌린 뒤 채움_

### ④ 알림 목록 — 정렬 컬럼이 인덱스와 다를 때

`notification/notification.service.ts:71` — 알림 화면.

```sql
-- 실제 쿼리 (occurred_at 정렬)
EXPLAIN
SELECT * FROM notification
WHERE user_id = 1
ORDER BY occurred_at DESC
LIMIT 20;

-- 비교: 인덱스 둘째 컬럼(created_at)으로 정렬
EXPLAIN
SELECT * FROM notification
WHERE user_id = 1
ORDER BY created_at DESC
LIMIT 20;
```

- 예상 (실제): `key = notification_user_id_created_at_idx`, `type = ref`, `Extra` 에 **`Using filesort`**.
- 예상 (비교): 같은 인덱스, `Using filesort` 가 사라진다 (`Backward index scan` 류 표시는 MariaDB 버전에 따라 없을 수 있음).
- 결과 (실제): _HeidiSQL 에서 돌린 뒤 채움_
- 결과 (비교): _HeidiSQL 에서 돌린 뒤 채움_

### ⑤ 파일 삭제 뒤 오브젝트 참조 확인 — 인덱스가 없는 쿼리

`file/file.service.ts:379` — 파일을 지울 때마다 돈다.

```sql
EXPLAIN
SELECT COUNT(*) FROM storage_file
WHERE object_key = 'users/1/00000000-0000-0000-0000-000000000000.pdf'
  AND deleted_at IS NULL;
```

- 예상: `type = ALL`, `key = NULL`, `rows` ≈ `storage_file` 전체 행 수.
- 결과: _HeidiSQL 에서 돌린 뒤 채움_

## 9. 확인 뒤 할 일 (판정 확정 후)

이 문서는 판정 후보만 적었다. 인덱스를 바꾸는 것은 EXPLAIN 결과를 보고 정한다.

| 후보 | 바꾸면 | 확인할 것 |
| --- | --- | --- |
| 중복 3개 삭제 | 쓰기마다 갱신할 인덱스가 줄어든다 | 같은 쿼리를 다시 EXPLAIN 했을 때 다른 인덱스로 타는지 |
| `notification` → `(user_id, occurred_at)` | 목록 filesort 제거 | ④ 의 `Using filesort` 가 사라지는지 |
| `storage_file (object_key)` 추가 | 파일 삭제 때 전체 스캔 제거 | ⑤ 가 `type = ref` 로 바뀌는지 |
| `transaction` 커버링 인덱스 순서 | `GROUP BY type` 쿼리도 `date` 로 좁히려면 `type` 을 뒤로 보내야 한다 — 그 대신 월별 추이 쿼리가 덜 맞게 된다 | ③ 의 `key_len` 결과를 보고 판단 |

인덱스를 바꿀 때는 루트 `CLAUDE.md` 의 순서(`migrate dev --create-only` → SQL 확인 → 적용)를 따른다.
