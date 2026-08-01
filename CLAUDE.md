# DocNexus — Claude 컨텍스트

## 이 프로젝트가 무엇인가

개인 문서·자산·계정 통합 보안 관리 플랫폼.
민감한 자격증명(계정, ENV, 신원 문서)을 AES-256-GCM 암호화로 저장하고, Google OAuth 또는 이메일 인증코드(`ALLOWED_EMAILS` 화이트리스트)로만 접근한다.
전 엔드포인트는 전역 JWT 가드로 보호되며, 로그인(`@Public()`)만 예외다.

기능 목록:

- 자격증명 관리 (계정·신원 번호·ENV 값 AES-256-GCM 암호화 저장) — **구현 완료**
- 파일 보관함 (Backblaze B2 — 폴더·업로드·presigned·MIME/매직바이트 검증·SHA-256 중복제거) — **구현 완료**
- 자산 현황 (금융 자산 요약·월별 추이·현금흐름 예측) — 구현 완료
- 캘린더 (일정 + 구독결제·예적금만기·신원만료 가상 이벤트 연동) / 구독 — 구현 완료
- 보안 코어 (마스터 잠금·접근 감사 로그·보안점수 추이·비번 회전·2FA 백업코드·강도 통계) — 구현 완료
- 외부 연동 (HIBP 유출 비밀번호 검사) — 구현 완료
- 통합 검색 / 데이터 내보내기(JSON·ZIP)·가져오기(계정 JSON 복원) — 구현 완료
- AI 리포트 (사용자별 OpenAI 키 — 가계부 분석·절약 인사이트) — 구현 완료

---

## 모노레포 구조

```text
doc-nexus/
├── frontend/          # Next.js (사용자 UI, 포트 3000)
├── backend/           # NestJS (API 서버, 포트 8000)
│   ├── prisma/        # schema.prisma, migrations/
│   └── src/
│       ├── auth/          # Google OAuth + JWT 인증 (+ 새 기기 로그인 감지)
│       ├── transaction/   # 수입/지출 내역
│       ├── recurring-schedule/ # 자동이체 설정 (반복거래/반복매수 자동 생성 규칙 — 등록 폼과 분리)
│       ├── saving/        # 예적금
│       ├── investment/    # 투자
│       ├── subscription/  # 구독 서비스
│       ├── asset/         # 자산 (순자산)
│       ├── notification/  # 알림
│       ├── calendar/      # 캘린더 (실제 일정 + 구독/예적금/신원 가상 이벤트 연동)
│       ├── security/      # 보안센터 + 마스터 잠금(VaultService/VaultGuard) + 유출검사·강도통계
│       ├── access-log/    # 보관함 접근 감사 로그 (전역)
│       ├── settings/      # 사용자 설정
│       ├── category/      # 카테고리 관리
│       ├── trash/         # 휴지통
│       ├── search/        # 통합 검색 (거래·계정·신원·ENV)
│       ├── dashboard/     # 대시보드 요약 + 현금흐름 예측 + 통합 D-day
│       ├── identity/      # 신원 지갑 (번호 AES 암호화 + 사본 이미지 fileId)
│       ├── credential/    # 계정 보관함 (비번·TOTP·백업코드 AES + 엑셀)
│       ├── env/           # ENV 보관함 (값 AES + 변경 이력/롤백)
│       ├── file/          # 파일 보관함 (Backblaze B2)
│       ├── export/        # 데이터 내보내기 (계정 JSON·전체 ZIP)
│       ├── import/        # 데이터 가져오기 (계정 JSON 복원)
│       ├── maintenance/   # 스케줄 크론 (알림·휴지통·보안점수 스냅샷·순자산 스냅샷·DB 백업·투자 현재가 갱신)
│       ├── ai/            # AI 리포트 (사용자별 OpenAI 키)
│       ├── mail/          # SMTP 메일 발송 (이메일 코드 로그인 등)
│       ├── push/          # 웹 푸시 구독/발송 (VAPID)
│       ├── convert/       # 이미지↔PDF 변환
│       ├── system-log/    # 시스템 로그 (크론·투자 갱신 등 백그라운드 작업 실행 기록, 90일 경과 시 자동 삭제)
│       ├── common/        # CryptoService(AES-256-GCM)·ClientInfo 등 공용
│       └── prisma/        # PrismaService / PrismaModule
├── docs/              # 설계 문서
└── docker-compose.yml
```

---

## 기술 스택

| 영역 | 기술 |
| --- | --- |
| Frontend | Next.js 16.2, React 19, TypeScript, Tailwind CSS v4 |
| 상태관리 | **TanStack Query(React Query)** — 서버 데이터 캐싱/무효화 (lib/query·queryKeys) |
| Backend | NestJS 11, TypeScript |
| ORM | Prisma |
| DB | MariaDB (docker-compose, 포트 3307) |
| 인증 | Google OAuth 2.0 + JWT (전역 가드) |
| Rate-limit | `@nestjs/throttler` (reveal/totp/복호화·vault unlock 엄격 제한) |
| 암호화 | AES-256-GCM (`CREDENTIAL_SECRET` 키, 보관함 민감필드) / 마스터 잠금은 scrypt 해시 |
| 스토리지 | Backblaze B2 (`@aws-sdk/client-s3`, presigned) |
| 유출검사 | HaveIBeenPwned Pwned Passwords (k-anonymity) |
| AI | OpenAI API (사용자별 키·모델, 설정에서 입력) |
| 패키지 매니저 | pnpm (모노레포) |

> 보관함 동작 전제: `backend/.env` 에 `CREDENTIAL_SECRET`(긴 랜덤값) 필수. 한 번 정하면 변경 금지(기존 암호문 복호화 불가).

---

## 데이터 모델 (ERD 요약)

| 엔티티 | 주요 필드 | 상태 |
| --- | --- | --- |
| User | id, google_id, email, name, picture | 구현 완료 |
| Transaction | user_id, type, category, amount, date, recurring_schedule_id | 구현 완료 |
| RecurringSchedule | user_id, kind(transaction/investment), rule(JSON), start_date, active | 구현 완료 |
| Saving | user_id, type, interest_rate, balance, maturity_date | 구현 완료 |
| Investment | user_id, type, principal, current_value, purchase_date | 구현 완료 |
| Subscription | user_id, name, amount, cycle, status, next_payment_date | 구현 완료 |
| Asset | user_id, name, type(cash/savings/investment/realestate/debt/etc), amount | 구현 완료 |
| NetWorthSnapshot | user_id, month, total_assets, total_debt | 구현 완료 |
| UserSettings | user_id, notif_*, session_expiry, pw_auto_hide, master_lock_*, categories/widgets(JSON), menu_order | 구현 완료 |
| Notification | user_id, group, tone, title, description, source, read_at | 구현 완료 |
| CalendarEvent | user_id, date, type(pay/due/exp/task), title, recur_freq, recur_until | 구현 완료 |
| SecurityRisk | user_id, category, severity, title, resolved | 구현 완료 |
| LoginSession | user_id, device, device_type, location, is_current, revoked_at | 구현 완료 |
| Category | user_id, domain, code, label, parent_code(2계층), sort_order, is_active | 구현 완료 |
| IdentityCard | user_id, type, name, number_enc(암호문), file_id(사본), issue/expire_date | 구현 완료 |
| Credential | user_id, name, category, username, password_enc, totp_enc, backup_codes_enc, password_changed_at | 구현 완료 |
| EnvProject | user_id, name, description | 구현 완료 |
| EnvVar | user_id, project_id, env, group, key, value_enc(암호문) | 구현 완료 |
| EnvVarHistory | env_var_id, user_id, value_enc(이전값 암호문) | 구현 완료 |
| StorageFolder | user_id, parent_id(무한중첩), name | 구현 완료 |
| StorageFile | user_id, folder_id, object_key(B2), name, size, mime_type, hash(SHA-256) | 구현 완료 |
| AccessLog | user_id, action, target_type/id/name, ip, user_agent | 구현 완료 |
| SecurityScoreSnapshot | user_id, date, score, reuse/weak/no2fa | 구현 완료 |
| PushSubscription | user_id, endpoint, p256dh, auth (웹 푸시 구독) | 구현 완료 |
| AiUsageLog | user_id, model, source, prompt/completion/total_tokens, cost_usd (OpenAI 호출별 토큰·비용) | 구현 완료 |
| RefreshToken | user_id, session_id, jti, expires_at, revoked_at (refresh 토큰 화이트리스트, rotation/로그아웃/세션revoke 시 폐기) | 구현 완료 |
| EmailLoginCode | email, code_hash(SHA-256), expires_at, consumed_at, attempts (이메일 인증코드 로그인, 화이트리스트 대조) | 구현 완료 |
| SystemLog | user_id(nullable, FK 아님), level(info/warn/error), category, message, metadata(JSON) — 크론·투자갱신 등 백그라운드 작업 로그, 90일 경과 시 자동 삭제 | 구현 완료 |

> DB: MariaDB, 문자셋: utf8mb4_unicode_ci · 총 30개 테이블
> 상세 스키마: [docs/erd.md](docs/erd.md)

---

## 현재 상태

| 영역 | 상태 |
| --- | --- |
| Frontend — 로그인 | 구현 완료 |
| Frontend — 대시보드 | 구현 완료 |
| Frontend — 가계부 (수입/지출/예적금/투자) | 구현 완료 |
| Frontend — 순자산 | 구현 완료 |
| Frontend — 구독 관리 | 구현 완료 |
| Frontend — 캘린더 | 구현 완료 |
| Frontend — 알림 | 구현 완료 |
| Frontend — 보안 | 구현 완료 |
| Frontend — 설정 | 구현 완료 |
| Frontend — 휴지통 | 구현 완료 |
| Frontend — 자격증명 / ENV / 신원지갑 | 구현 완료 (백엔드 연동) |
| Frontend — 파일 보관함 | 구현 완료 (B2 연동) |
| Frontend — AI 리포트 | 구현 완료 (백엔드 연동) |
| Frontend — 시스템 로그 | 구현 완료 (백엔드 연동) |
| Frontend — React Query 전환 | 전 페이지·공통 컴포넌트 완료 |
| Backend — Google OAuth + JWT (전역 가드 + Rate-limit) | 구현 완료 |
| Backend — 가계부/구독/자산/캘린더 | 구현 완료 |
| Backend — 알림/보안/설정/휴지통/통합검색/대시보드 | 구현 완료 |
| Backend — 보관함 (신원/계정/ENV, AES 암호화) | 구현 완료 |
| Backend — 마스터 잠금·접근로그·보안점수추이·유출검사·강도통계 | 구현 완료 |
| Backend — 파일 보관함 (Backblaze B2) | 구현 완료 |
| Backend — 데이터 내보내기/가져오기 (JSON·ZIP·복원) | 구현 완료 |
| Backend — 현금흐름 예측·통합 D-day | 구현 완료 |
| Backend — AI 리포트 (OpenAI, 사용자별 키) | 구현 완료 |
| Backend — 시스템 로그 / 순자산 월간 스냅샷 / 투자 현재가 자동 갱신 | 구현 완료 |
| DB | 30개 테이블 구현 완료 |

---

## 개발 명령어

```bash
pnpm install                           # 전체 의존성 설치
pnpm run db                            # MariaDB 컨테이너 시작 (포트 3307)
pnpm run dev                           # frontend + backend 동시 실행
pnpm run dev:backend                   # backend만 실행
pnpm run dev:frontend                  # frontend만 실행
pnpm run db:stop                       # DB 컨테이너 중지

# DB 마이그레이션 (스키마 변경 시)
cd backend && npx prisma migrate dev   # = prisma migrate dev

# Prisma Studio (GUI로 데이터 확인)
cd backend && npx prisma studio        # localhost:5555

# Prisma 타입 재생성
cd backend && npx prisma generate
```

---

## 운영 배포 (홈서버)

`.github/workflows/deploy-home-server.yml`이 `docker compose build` → `prisma migrate deploy`
(1회성 컨테이너) → `docker compose up -d` 순서로 자동 실행한다 — work-nexus와 동일한 방식으로
2026-08-01에 전환(원래는 배포와 마이그레이션 시점을 의도적으로 분리했었으나, 수동 적용을
누락하기 쉬워 자동화로 되돌림). 별도 수동 조치 불필요.

수동으로 다시 적용해야 할 때만 아래처럼 직접 실행한다.

```bash
# 홈서버 SSH 접속 후
cd ~/doc-nexus
docker compose exec backend npx prisma migrate deploy
```

> `migrate dev`(신규 마이그레이션 생성, dev 전용)와 달리 `migrate deploy`는
> 이미 존재하는 마이그레이션 파일을 프롬프트 없이 적용만 한다.

---

## 슬래시 커맨드

| 커맨드 | 동작 |
| --- | --- |
| `/push` | develop 브랜치에 커밋 + 푸시 |
| `/migrate` | prisma migrate dev 실행 |

---

## 코드 주석 규칙

- 백엔드 / 프론트엔드에서 **새로운 함수 또는 메서드를 추가**할 때, 해당 함수/메서드 위에 한 줄 주석으로 동작을 간략히 설명한다.
- **기존 함수/메서드를 수정**했을 때, 기존 주석이 있으면 변경된 동작에 맞게 주석 내용도 함께 수정한다.
- 주석은 한국어로 작성하며, 무엇을 하는지(WHAT)가 아니라 왜(WHY) 또는 비자명한 동작에 집중한다.

---

## DB 컬럼 코멘트 규칙 (migration.sql / schema.prisma `///`)

신규 테이블 추가 시 CREATE TABLE 안에 컬럼/테이블 코멘트를 함께 작성한다 (별도 ALTER 불필요).

### 공통 컬럼 코멘트

| 컬럼 | 코멘트 |
| --- | --- |
| `id` | `'고유번호'` |
| FK 컬럼 (`xxx_id`) | `'참조테이블.id FK'` (예: `'user.id FK'`) |
| `created_at` | `'생성일(KST)'` |
| `updated_at` | `'수정일(KST)'` |
| 단일 타임스탬프 (`joined_at` 등) | `'동작명(KST)'` (예: `'가입일(KST)'`) |
| ENUM 컬럼 | 값 목록 없이 짧게 (예: `'역할'`, `'상태'`) |

### 테이블 코멘트

- `COMMENT='한글 테이블명'` 형태로 간결하게 작성 (예: `COMMENT='사용자'`)

### KST 타임스탬프 트리거

신규 테이블에 `created_at` / `updated_at` 이 있으면
반드시 KST 트리거를 함께 추가한다.
Prisma가 `@default(now())` / `@updatedAt` 을 UTC 문자열로
전송하므로 트리거로 덮어씌워야 한국시간으로 저장된다.
(전제: MySQL `@@global.time_zone = +09:00`)

<!-- markdownlint-disable MD013 -->
```sql
-- created_at + updated_at 모두 있는 경우
CREATE TRIGGER `tr_xxx_bi` BEFORE INSERT ON `xxx` FOR EACH ROW SET NEW.created_at = NOW(), NEW.updated_at = NOW();
CREATE TRIGGER `tr_xxx_bu` BEFORE UPDATE ON `xxx` FOR EACH ROW SET NEW.updated_at = NOW();

-- created_at 만 있는 경우
CREATE TRIGGER `tr_xxx_bi` BEFORE INSERT ON `xxx` FOR EACH ROW SET NEW.created_at = NOW();
```
<!-- markdownlint-enable MD013 -->

트리거는 별도 마이그레이션 파일로 분리하거나, 테이블 생성 마이그레이션 하단에 함께 작성한다.

---

## 참고 문서

- [docs/erd.md](docs/erd.md) — DB 엔티티 정의
- [docs/api.md](docs/api.md) — API 명세
- [docs/category-migration.md](docs/category-migration.md) — 카테고리 2계층 구조 + 엑셀→앱 매칭표(실데이터 마이그레이션용)
