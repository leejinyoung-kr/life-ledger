# DocNexus — Claude 컨텍스트

## 이 프로젝트가 무엇인가

개인 문서·자산·계정 통합 보안 관리 플랫폼.
민감한 자격증명(계정, ENV, 신원 문서)을 AES-256 암호화로 저장하고, Google OAuth로만 접근한다.

기능 목록 (예정):

- 자격증명 관리 (계정·API키·ENV 파일 암호화 저장)
- 파일 보관함 (Cloudflare R2 — 신원 문서·파일 업로드)
- 자산 현황 (금융 자산 요약·월별 추이)
- AI 리포트 (Claude API 기반 분석)
- 캘린더 / 할 일
- 보안 감사 로그

---

## 모노레포 구조

```text
doc-nexus/
├── frontend/          # Next.js (사용자 UI, 포트 3000)
├── backend/           # NestJS (API 서버, 포트 8000)
│   ├── prisma/        # schema.prisma, migrations/
│   └── src/
│       ├── auth/          # Google OAuth + JWT 인증
│       ├── transaction/   # 수입/지출 내역
│       ├── saving/        # 예적금
│       ├── investment/    # 투자
│       ├── subscription/  # 구독 서비스
│       ├── asset/         # 자산 (순자산)
│       ├── note/          # 메모
│       ├── calendar/      # 캘린더 이벤트
│       ├── notification/  # 알림
│       ├── task/          # 할 일 + 목표
│       ├── security/      # 보안 감사 로그
│       ├── settings/      # 사용자 설정
│       ├── trash/         # 휴지통
│       └── prisma/        # PrismaService / PrismaModule
├── docs/              # 설계 문서
└── docker-compose.yml
```

---

## 기술 스택

| 영역 | 기술 |
| --- | --- |
| Frontend | Next.js 16.2, React 19, TypeScript, Tailwind CSS v4 |
| Backend | NestJS 11, TypeScript |
| ORM | Prisma |
| DB | MariaDB (docker-compose, 포트 3308) |
| 인증 | Google OAuth 2.0 + JWT |
| 스토리지 | Cloudflare R2 (예정) |
| AI | Claude API `claude-sonnet-4-6` (예정) |
| 패키지 매니저 | pnpm (모노레포) |

---

## 데이터 모델 (ERD 요약)

| 엔티티 | 주요 필드 | 상태 |
| --- | --- | --- |
| User | id, google_id, email, name, picture | 구현 완료 |
| Transaction | user_id, type, category, amount, date, is_recurring | 구현 완료 |
| Saving | user_id, type, interest_rate, balance, maturity_date | 구현 완료 |
| Investment | user_id, type, principal, current_value, purchase_date | 구현 완료 |
| Subscription | user_id, name, amount, billing_cycle, next_billing_date | 구현 완료 |
| Asset | user_id, name, type, value | 구현 완료 |
| NetWorthSnapshot | user_id, total_assets, total_liabilities, recorded_at | 구현 완료 |
| UserSettings | user_id, currency, language, theme 등 | 구현 완료 |
| Notification | user_id, type, title, message, is_read | 구현 완료 |
| Task | user_id, title, due_date, is_done, priority | 구현 완료 |
| Goal | user_id, title, target_amount, current_amount, deadline | 구현 완료 |
| Note | user_id, title, content, tags | 구현 완료 |
| CalendarEvent | user_id, title, start_at, end_at, type | 구현 완료 |
| SecurityRisk | user_id, type, description, resolved_at | 구현 완료 |
| LoginSession | user_id, device, ip, created_at, revoked_at | 구현 완료 |

> DB: MariaDB, 문자셋: utf8mb4_uca1400_ai_ci  
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
| Frontend — 할 일 / 목표 | 구현 완료 |
| Frontend — 메모 | 구현 완료 |
| Frontend — 캘린더 | 구현 완료 |
| Frontend — 알림 | 구현 완료 |
| Frontend — 보안 | 구현 완료 |
| Frontend — 설정 | 구현 완료 |
| Frontend — 휴지통 | 구현 완료 |
| Frontend — 자격증명 / ENV / 파일 / 신원지갑 | UI 완료 (백엔드 미구현) |
| Frontend — AI 리포트 / 어시스턴트 | UI 완료 (백엔드 미구현) |
| Backend — Google OAuth + JWT | 구현 완료 |
| Backend — 가계부 API (transaction/saving/investment) | 구현 완료 |
| Backend — 구독/자산/메모/캘린더/할 일/목표 | 구현 완료 |
| Backend — 알림/보안/설정/휴지통 | 구현 완료 |
| DB | 15개 테이블 구현 완료 |

---

## 개발 명령어

```bash
pnpm install                           # 전체 의존성 설치
pnpm run db                            # MariaDB 컨테이너 시작 (포트 3308)
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

## 슬래시 커맨드

| 커맨드 | 동작 |
| --- | --- |
| `/deploy` | develop 브랜치에 커밋 + 푸시 |
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
