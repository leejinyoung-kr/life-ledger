# LifeLedger (생활 장부) — Claude 컨텍스트

## 이 프로젝트가 무엇인가

자산 · 구독 · 계정 · 일정을 한곳에서 관리하는 개인 생활 장부 (2026-10 공개 준비 때 doc-nexus 에서 이름을 바꿨다 — B2 버킷 · 볼륨 이름은 그대로, DB · 사용자는 2026-10-15 `docnexus` → `lifeledger`).
민감한 자격증명(계정 비밀번호 · 2FA 시크릿)을 AES-256-GCM 암호화로 저장하고, Google OAuth 또는 이메일 인증코드(`ALLOWED_EMAILS` 화이트리스트)로만 접근한다.
전 엔드포인트는 전역 JWT 가드로 보호되며, 로그인(`@Public()`)만 예외다.

기능 목록:

- 자격증명 관리 (계정 비밀번호·TOTP·백업코드 AES-256-GCM 암호화 저장) — **구현 완료**
- 파일 보관함 (Backblaze B2 — 폴더·업로드·presigned·MIME/매직바이트 검증·SHA-256 중복제거·전체 검색·폴더/전체 ZIP 다운로드·폴더째 업로드·비우기) — **구현 완료**
- 자산 현황 (현금·예적금·투자 순자산 요약·월별 추이·현금흐름 예측) — 구현 완료
- 캘린더 (일정 + 구독결제·예적금만기·투자계좌만기(ISA 등) 가상 이벤트 연동) / 구독 — 구현 완료
- 보안 (로그인 기기/세션·마스터 잠금·접근 감사 로그·비번 회전 알림·2FA 백업코드) — 구현 완료
- 통합 검색 / 데이터 내보내기(JSON·ZIP)·가져오기(계정 JSON 복원) — 구현 완료

---

## 구조

```text
life-ledger/
├── frontend/          # Next.js (사용자 UI, 포트 3000)
├── backend/           # NestJS (API 서버, 포트 8000)
│   ├── prisma/        # schema.prisma, migrations/
│   └── src/
│       ├── auth/          # Google OAuth + JWT 인증 (+ 새 기기 로그인 감지)
│       ├── transaction/   # 수입/지출 내역
│       ├── recurring-schedule/ # 자동이체 설정 (반복거래/반복매수 자동 생성 규칙 — 등록 폼과 분리)
│       ├── transaction-favorite/ # 거래 즐겨찾기 (자주 쓰는 수입/지출 — 오늘 날짜로 불러오기)
│       ├── saving/        # 예적금
│       ├── investment/    # 투자
│       ├── subscription/  # 구독 서비스
│       ├── asset/         # 순자산 요약/추이 (현금+예적금+투자 집계, 전용 테이블 없음)
│       ├── notification/  # 알림
│       ├── calendar/      # 캘린더 (실제 일정(양력/음력) + 구독/예적금/투자계좌만기/공휴일 가상 이벤트 연동)
│       ├── holiday/       # 공휴일·대체공휴일 (공공데이터포털 특일 정보 API 연동 + 연 단위 캐싱)
│       ├── security/      # 로그인 세션 + 마스터 잠금(VaultService/VaultGuard) + 열람 기록 조회
│       ├── access-log/    # 보관함 접근 감사 로그 (전역)
│       ├── settings/      # 사용자 설정
│       ├── category/      # 카테고리 관리
│       ├── search/        # 통합 검색 (거래·계정)
│       ├── dashboard/     # 대시보드 요약 + 현금흐름 예측 + 통합 D-day
│       ├── credential/    # 계정 보관함 (비번·TOTP·백업코드 AES + 엑셀)
│       ├── file/          # 파일 보관함 (Backblaze B2)
│       ├── export/        # 데이터 내보내기 (계정 JSON·전체 ZIP)
│       ├── import/        # 데이터 가져오기 (계정 JSON 복원)
│       ├── maintenance/   # 예약 작업 @Job(core-jobs) (알림·순자산 스냅샷·DB 백업·투자 현재가 갱신·구독 결제일 갱신·공휴일 사전 캐싱·소프트삭제 항목 자동정리) + 실행 기록 저장소(job_run)
│       ├── mail/          # SMTP 메일 발송 (이메일 코드 로그인 등)
│       ├── push/          # 웹 푸시 구독/발송 (VAPID) + 발송 아웃박스 저장소·채널(outbox_message)
│       ├── system-log/    # 시스템 로그 (크론·투자 갱신 등 백그라운드 작업 실행 기록, 90일 경과 시 자동 삭제)
│       ├── meta/          # GET /_meta 수집기 — 예약 작업 마지막 성공·아웃박스 적체·켜진 알림 채널(core-common MetaModule)
│       ├── common/        # CryptoService(AES-256-GCM)·ClientInfo 등 공용
│       └── prisma/        # PrismaService / PrismaModule
├── docs/              # 설계 문서
└── docker-compose.yml
```

### 데이터 모델 (ERD 요약)

| 엔티티 | 주요 필드 | 상태 |
| --- | --- | --- |
| User | id, google_id, email, name, picture | 구현 완료 |
| Transaction | user_id, type, category, amount, date, recurring_schedule_id | 구현 완료 |
| RecurringSchedule | user_id, kind(transaction/investment), rule(JSON), start_date, active | 구현 완료 |
| TransactionFavorite | user_id, type(income/expense), title, category, amount, pay_method, sort_order | 구현 완료 |
| Saving | user_id, type, interest_rate, balance, maturity_date | 구현 완료 |
| Investment | user_id, type, principal, current_value, purchase_date | 구현 완료 |
| Subscription | user_id, name, amount, cycle, status, next_payment_date, billing_day(원래 결제일) | 구현 완료 |
| NetWorthSnapshot | user_id, month, total_assets, total_debt(부동산/부채 기능 제거 이후 항상 0), cash_total(현금 스냅샷 캐시) | 구현 완료 |
| UserSettings | user_id, notif_*, session_expiry, pw_auto_hide, master_lock_*, categories(JSON) | 구현 완료 |
| Notification | user_id, group, tone, title, description, source, read_at | 구현 완료 |
| CalendarEvent | user_id, date, type(pay/due/exp/task), title, is_lunar/lunar_month/lunar_day/lunar_leap, recur_freq, recur_until, notify(당일 9시 알림) | 구현 완료 |
| Holiday | date, name, is_substitute, year (전 사용자 공용 캐시, user_id 없음) | 구현 완료 |
| LoginSession | user_id, device, device_type, location, is_current, revoked_at | 구현 완료 |
| Category | user_id, domain, code, label, parent_code(2계층), sort_order, is_active | 구현 완료 |
| Credential | user_id, name, category, username, password_enc, totp_enc, backup_codes_enc, password_changed_at | 구현 완료 |
| StorageFolder | user_id, parent_id(무한중첩), name | 구현 완료 |
| StorageFile | user_id, folder_id, object_key(B2), name, size, mime_type, hash(SHA-256) | 구현 완료 |
| AccessLog | user_id, action, target_type/id/name, ip, user_agent | 구현 완료 |
| PushSubscription | user_id, endpoint, p256dh, auth (웹 푸시 구독) | 구현 완료 |
| RefreshToken | user_id, session_id, jti, expires_at, revoked_at (refresh 토큰 화이트리스트, rotation/로그아웃/세션revoke 시 폐기) | 구현 완료 |
| EmailLoginCode | email, code_hash(SHA-256), expires_at, consumed_at, attempts (이메일 인증코드 로그인, 화이트리스트 대조) | 구현 완료 |
| SystemLog | user_id(nullable, FK 아님), level(info/warn/error), category, message, metadata(JSON) — 크론·투자갱신 등 백그라운드 작업 로그, 90일 경과 시 자동 삭제 | 구현 완료 |
| JobRun | job, triggered_by(schedule/manual), status(running/succeeded/failed), started_at, lease_until, finished_at, summary, error, running_key(유니크 — 동시 실행 방지) — 예약 작업 실행 기록(core-jobs), 90일 경과 시 자동 삭제 | 구현 완료 |
| OutboxMessage | channel, payload(JSON), idempotency_key(유니크 — `noti:<알림 id>`), status(pending/sending/sent/failed), attempts, max_attempts, available_at, claimed_until, last_error, sent_at — 알림 발송 아웃박스(core-notification). 알림 행과 **같은 트랜잭션**에 적재되므로 롤백되면 발송도 없다. 끝난 행(sent/failed)은 90일 경과 시 자동 삭제 | 구현 완료 |

> DB: MariaDB, 문자셋: utf8mb4_unicode_ci · 총 25개 테이블
> 상세 스키마: [docs/erd.md](docs/erd.md)

---

## 기술 스택

| 영역 | 기술 |
| --- | --- |
| Frontend | Next.js 16.2, React 19, TypeScript, Tailwind CSS v4 |
| 상태관리 | **TanStack Query(React Query)** — 서버 데이터 캐싱/무효화 (lib/query·queryKeys) |
| Backend | NestJS 11, TypeScript |
| ORM | Prisma |
| DB | MariaDB — `infra` 레포의 공용 MariaDB(포트 13306), 데이터베이스 `lifeledger` · 전용 사용자 `lifeledger` |
| 인증 | Google OAuth 2.0 + JWT (전역 가드) |
| Rate-limit | `@nestjs/throttler` (reveal/totp/복호화·vault unlock 엄격 제한) |
| 암호화 | AES-256-GCM (`CRYPTO_KEYS` 키링 + 필드·사용자 문맥(AAD), 보관함 민감필드) / 마스터 잠금은 scrypt 해시 |
| 스토리지 | Backblaze B2 (`@aws-sdk/client-s3`, presigned) |
| 패키지 매니저 | pnpm (모노레포) |

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
| Frontend — 보안 (로그인 기기·보안 설정·최근 열람) | 구현 완료 |
| Frontend — 설정 (프로필·데이터) | 구현 완료 |
| Frontend — 자격증명 | 구현 완료 (백엔드 연동) |
| Frontend — 파일 보관함 | 구현 완료 (B2 연동) |
| Frontend — 시스템 로그 | 구현 완료 (백엔드 연동) |
| Frontend — React Query 전환 | 전 페이지·공통 컴포넌트 완료 |
| Backend — Google OAuth + JWT (전역 가드 + Rate-limit) | 구현 완료 |
| Backend — 가계부/구독/자산/캘린더 | 구현 완료 |
| Backend — 알림/보안/설정/통합검색/대시보드 | 구현 완료 |
| Backend — 계정 보관함 (AES 암호화) | 구현 완료 |
| Backend — 마스터 잠금·접근로그·세션 | 구현 완료 |
| Backend — 파일 보관함 (Backblaze B2) | 구현 완료 |
| Backend — 데이터 내보내기/가져오기 (JSON·ZIP·복원) | 구현 완료 |
| Backend — 현금흐름 예측·통합 D-day | 구현 완료 |
| Backend — 시스템 로그 / 순자산 월간 스냅샷 / 투자 현재가 자동 갱신 | 구현 완료 |
| DB | 25개 테이블 구현 완료 |

---

## 명령

```bash
pnpm install                           # 전체 의존성 설치
pnpm run db                            # 공용 MariaDB 시작 (../infra compose, 포트 13306 — 앱 여럿이 쓰니 여기서 끄지 않는다)
pnpm run dev                           # frontend + backend 동시 실행
pnpm run dev:backend                   # backend만 실행
pnpm run dev:frontend                  # frontend만 실행

# DB 마이그레이션 (스키마 변경 시)
cd backend && npx prisma migrate dev   # = prisma migrate dev

# Prisma Studio (GUI로 데이터 확인)
cd backend && npx prisma studio        # localhost:5555

# Prisma 타입 재생성
cd backend && npx prisma generate
```

### 운영 배포 (홈서버)

`.github/workflows/deploy-home-server.yml`이 `docker compose build` → `check-env`(환경변수·키 설정)
→ `prisma migrate deploy`(1회성 컨테이너) → `crypto-check`(암호문 전체 복호화 점검, 읽기만)
→ `docker compose up -d` → backend healthy 대기 → `crypto-check`(결과 기록) 순서로 자동 실행한다
(2026-08-01 전환 — 원래는 배포와 마이그레이션 시점을 의도적으로 분리했었으나, 수동 적용을
누락하기 쉬워 자동화로 되돌림). `up -d` 전 점검이 실패하면 기존 컨테이너가 그대로 서비스한다.
서버 `.env` 만 바꿨을 때(키 교체 등)는 Actions 에서 수동 실행(`workflow_dispatch`)한다.
외부 접속은 앱 전용 Tailscale 사이드카(compose `tailscale`, 프로필 `homeserver`) `https://lifeledger.tailba78c1.ts.net` — `/` frontend · `/api` backend 가 같은 origin 이다(`tailscale/serve.json`, infra README "외부 접속"). 2026-10-10 전에는 홈서버 노드 Funnel 443(화면)·8443(API) 이었다.
DB 는 이 워크플로가 다루지 않는다 — `infra` 레포(`~/apps/infra`)의 공용 MariaDB 이고 수동으로 띄운다. 루트 `.env` 의 `DB_PASSWORD` 는 `infra/.env` 의 `LIFELEDGER_DB_PASSWORD` 와 같아야 한다.

수동으로 다시 적용해야 할 때만 아래처럼 직접 실행한다.

```bash
# 홈서버 SSH 접속 후
cd ~/apps/life-ledger
docker compose exec backend npx prisma migrate deploy
```

> `migrate dev`(신규 마이그레이션 생성, dev 전용)와 달리 `migrate deploy`는
> 이미 존재하는 마이그레이션 파일을 프롬프트 없이 적용만 한다.

### 슬래시 커맨드

| 커맨드 | 동작 |
| --- | --- |
| `/push` | 기본 브랜치(`main`)에 커밋 + 푸시 — push 하면 홈서버 배포가 돈다 |
| `/migrate` | prisma migrate dev 실행 |

---

## 규칙

코드 주석·커밋 메시지·DB 컬럼 코멘트는 루트 `develop/CLAUDE.md` 공통 규칙을 따른다. 이 프로젝트에만 있는 것:

- **프론트 공통 요소** (`frontend/`): 새 화면은 아래 요소만 쓴다. 모자라면 날 것으로 만들지 말고 요소를 보강한다. **className 은 배치용(flex-1 · w-full · margin)으로만, 모양은 variant · size prop** — clsx · tailwind-merge 가 없어 className 으로 기본 스타일을 덮어쓰지 않는다. `frontend/__tests__/ui-conventions.test.ts` 가 소스를 검사해 어기면 테스트가 실패한다.

  | 용도 | 요소 |
  | --- | --- |
  | 페이지 제목 (h1 · 부제목 · 우측 버튼) | `components/PageHeader` — 페이지에서 h1 을 직접 쓰지 않는다. 추가 같은 버튼은 늘 제목 줄 오른쪽(휴대폰도) — 휴대폰에서 넘치면 글자를 줄이거나(`추가`) 덜 쓰는 버튼을 숨긴다 |
  | 버튼 / 아이콘 버튼 | `ui/Button` (`variant` · `size` · `loading`, 글줄 안 링크는 `variant="link" size="inline"`) / `ui/IconButton` (`label` 필수, `variant` · `size`) |
  | 검색 입력 | `ui/SearchInput` (`onEnter`) |
  | 입력 그룹 · 오류 | `ui/Field` — `error` 가 있으면 안의 `.input` 이 자동으로 빨개진다. `is-invalid` 를 손으로 붙이지 않는다 (Field 밖은 `aria-invalid`) |
  | 탭 | 밑줄 · 세로 `ui/Tabs`, 알약 · 묶음 `ui/Segmented` (`role="tablist"`, 창 안에서 칸을 꽉 채우려면 `fill`) |
  | 카드 / 배지 / 토글 | `ui/Card`(`clip` · `hover` · `onClick` · `tone` accent · danger) / `ui/Badge`(`tone` · `size`, 상태에만) / `ui/Toggle` |
  | 모달 | `Modal`(`size` · `subtitle` · `headerAction` · `footer`, 휴대폰도 여백 두고 가운데) · `ConfirmModal`(확인 · 입력이 붙는 확인은 `children` · `layer`) |
  | 빈 상태 · 로딩 · 오류 | `EmptyState`(`size`) · `QueryState` / `PageLoading`(`size`) · `ErrorBanner` · `QueryError`, 테이블 빈 행은 `TableEmptyRow` |
  | 조회 조건 박스 / 엑셀 버튼 줄 | `FilterPanel` / `ExcelToolbar` |
  | 목록 위 도구 줄 (총 n건 ··· 선택삭제 · n개) | `ListToolbar`(`total` · `unit`, 합계 · 안내는 `summary`, 엑셀 · 통화는 `tools` — 휴대폰은 둘째 줄로) |
  | 휴대폰 목록 (md 미만, 표 대신) | `MobileCardList`(흰 카드 하나에 선으로 나눈 칸 — 알림 목록과 같은 모양) 안에 `MobileCard`(`title` · `sub` · `aside` · `fields` 이름표 줄 · `actions` 같은 폭 버튼, 여러 줄이면 배열의 배열). 카드에 체크박스가 있으면 `MobileCardList selection` 으로 전체선택 줄 (알림처럼 흰 카드 머리에 둘 때는 `SelectAllBar` 직접) |
  | 가로로 넘치는 줄 (알약 · 띠) | `DragScroll`(얇은 막대 + 마우스로 끌어 넘기기) — 막대를 숨기는 `scrollbar-none` 은 넘칠 일 없는 탭에만 |
  | 숫자 카드 / 막대 차트 | `StatStrip` 안에 `StatCard`(금액 색은 `valueTone` in · out · move 일 때만) / `BarChart`(`tone` out · neutral, `height="fill"` 이면 부모 높이를 채움) |
  | 아이콘 | `components/icons` 의 `Icon*` (lucide 한 세트를 앱 이름으로 묶음) — 이모지는 쓰지 않는다 |
  | 더보기 메뉴 | `ui/MoreMenu`(`items` — 표 관리 열 · 카드는 "자주 쓰는 하나 + 더보기") |
  | 체크박스 | `<input type="checkbox" className="checkbox">` |

  모서리 · 그림자는 `rounded-ui`(8px) · `rounded-panel`(14px) · `shadow-card` · `shadow-raised` · `shadow-overlay` 토큰 유틸을 쓴다 (`rounded-[var(--radius)]` 같은 표기 금지). `rounded-lg` 는 Tailwind 기본 8px 이라 14px 이 아니다. 색은 `text-danger` · `border-accent/30` 처럼 토큰 + 투명도로 쓰고 hex · rgba 를 직접 적지 않는다.

- **보관함 암호화**: `backend/.env` 의 `CRYPTO_KEYS`(`<키ID>:<32자 이상 시크릿>` 콤마 구분, 첫 번째가 현재 키) 필수. 이 값을 잃으면 보관함 데이터 복구 불가 — 서버 밖에도 보관. 암호문은 `v2:<키ID>:...` 이고 `cipherContext(필드, 사용자 id)`(`src/crypto/crypto-fields.ts`)를 AAD 로 묶어, 다른 필드·다른 사용자 행으로 옮기면 풀리지 않는다. **키 교체**: 새 키를 맨 앞에 추가 → 배포(부팅 시 현재 키가 아닌 암호문 자동 재암호화) → 이전 키 제거 → 배포. `CREDENTIAL_SECRET` 은 이전 포맷(v1) 읽기 전용이라 재암호화가 끝나면 비운다. 이전 키로 된 암호문이 남았는데 키를 빼면 배포 전 점검(`node dist/crypto/crypto-check.js`, 전체 복호화)과 부팅이 막는다. 암호문 컬럼을 추가하면 `ENCRYPTED_COLUMNS` 에도 추가 — `crypto-fields.spec.ts` 가 schema.prisma 와 대조해 강제. 재암호화는 raw SQL(compare-and-swap)이라 `updated_at` 을 건드리지 않는다. **암호문 컬럼에 평문을 쓰면 저장되지 않는다** — `PrismaService` 가 `encryptedFields`(core-security/prisma) 쓰기 가드를 걸어 `EncryptedFieldError` 로 막는다(목록은 `ENCRYPTED_COLUMNS` 에서 자동 생성). 읽을 때 자동 복호화는 하지 않는다 — 열람은 잠금·감사 로그를 거치는 명시적 행위로 남긴다. 재암호화·점검의 raw SQL 경로는 가드를 거치지 않는다.

- **인증 전제**: `JWT_SECRET`(access)·`JWT_REFRESH_SECRET`(refresh 쿠키)·`JWT_VAULT_SECRET`(보관함 잠금해제 토큰)은 **서로 다른** 32자 이상 랜덤값이어야 한다 — 누락·중복·예시값이면 부팅 실패. access 토큰은 `iss`/`aud` = `life-ledger` 로 발급·검증한다(`auth/jwt.constants.ts`). refresh 시크릿을 바꾸면 전 기기 재로그인, vault 시크릿을 바꾸면 보관함 재잠금. `ALLOWED_EMAILS` 는 필수(비면 부팅 실패) — 목록 밖 계정은 구글·이메일 코드 로그인 모두 거부.

- **환경변수**: 백엔드는 `process.env` 를 직접 읽지 않고 `backend/src/config/env.ts` 의 `env` 만 읽는다(`@leejinyoung-kr/core-config` 의 `defineEnv` — import 하는 순간 `.env` 로드 + 검증, 틀린 키를 전부 출력하고 부팅 중단). 키를 추가·삭제하면 `env.ts` 와 `backend/.env.example` 을 같이 고친다 — `src/config/env.spec.ts` 가 두 목록 일치·`process.env` 직접 사용 금지를 테스트로 강제한다(도커 빌드 테스트 단계라 배포에서도 막힘). 배포 워크플로는 컨테이너 교체 전에 새 이미지로 `node dist/config/check-env.js` 를 돌려, 서버 `.env` 가 새 스키마에 안 맞으면 기존 컨테이너를 유지한 채 멈춘다. SMTP(HOST·USER·PASS)·VAPID(공개·비공개 키)는 일부만 설정하면 부팅 실패.

- **예약 작업**: `@nestjs/schedule` 의 `@Cron` 대신 `@leejinyoung-kr/core-jobs` 의 `@Job({ name, cron, leaseMs })` 을 쓴다(`maintenance/`). 작업 코드는 결과 요약 문자열을 돌려주고, 실패는 삼키지 말고 던진다 — 실행 기록(`job_run`)·겹침 방지·lease 만료 마감·실패 시 시스템 로그는 core-jobs 와 `maintenance/job-run.store.ts` 가 맡는다. 운영에서 "며칠째 안 돈 작업"은 `GET /api/v1/_meta` 의 `jobs` 구역(작업별 마지막 성공·경과 시간)으로 본다 — 원본은 `job_run` 테이블.

- **운영 상태 확인**: `GET /api/v1/_meta`(로그인 필요) 가 빌드 커밋·설치된 `@leejinyoung-kr/core-*` 버전과 함께 예약 작업(마지막 성공·다음 실행)·아웃박스 적체·켜진 알림 채널을 한 번에 보여준다. **`warn` 배열만 먼저 보면 된다** — 비어 있으면 볼 게 없다는 뜻. 구역을 추가하려면 `meta/` 에 `MetaContributor` 를 만들어 `app.module.ts` 의 `MetaModule.forRoot({ contributors })` 에 넣는다(코어는 테이블을 모른다).

- **알림 + 푸시**: 알림을 만들면서 푸시를 보내려면 `NotificationService.createWithPush()` 를 쓴다 — 알림 행 저장과 푸시 적재(`outbox_message`)가 한 트랜잭션이라, 저장이 롤백되면 푸시도 나가지 않는다. 푸시를 직접 보내지 않는다(발송·재시도·실패 기록은 아웃박스가 맡는다. 멱등키는 `noti:<알림 id>`). 즉시 결과를 봐야 하는 것(설정 화면의 테스트 푸시, 로그인 인증코드 메일)만 예외로 바로 보낸다.


---

## 참고 문서

- [docs/planning.md](docs/planning.md) — 화면 기획(디자인 개편용 — 화면별 데이터·동작·바라는 점)
- [docs/architecture.md](docs/architecture.md) — 구조·모듈
- [docs/erd.md](docs/erd.md) — DB 엔티티 정의
- [docs/api.md](docs/api.md) — API 명세
- [docs/archive/2026-10-13-public-release-plan.md](docs/archive/2026-10-13-public-release-plan.md) — 공개 준비(포트폴리오) 계획 — 2026-10-15 끝남(이름 전환 · 데모 · DB 이름 · public). 데모 운영 절차는 이 문서 "5단계"
- [docs/category-migration.md](docs/category-migration.md) — 카테고리 2계층 구조 + 엑셀→앱 매칭표(실데이터 마이그레이션용)
- [docs/archive/](docs/archive/) — 끝난 작업의 설계·계획 문서
