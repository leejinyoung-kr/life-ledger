# LifeLedger

자산 · 구독 · 계정 · 일정을 한곳에서 관리하는 개인 생활 장부

## 시작하기

### 요구사항

- Node.js 26+
- pnpm
- Docker

### 설치

```bash
# 의존성 설치
pnpm install

# 환경 변수 설정
cp backend/.env.example backend/.env
# backend/.env 편집 — DATABASE_URL, Google OAuth, ALLOWED_EMAILS, B2, JWT_SECRET·JWT_REFRESH_SECRET·JWT_VAULT_SECRET(서로 다른 값),
#   CRYPTO_KEYS(보관함 암호화 키 "<키ID>:<시크릿>", 예: echo "k$(date +%y%m):$(openssl rand -hex 32)") 필수
#   — 빠지거나 틀리면 부팅 시 틀린 키를 전부 출력하고 멈춘다

# DB 시작
pnpm run db

# 마이그레이션
cd backend && pnpm prisma:migrate

# 개발 서버 실행
pnpm run dev
```

### 접속

- Frontend: <http://localhost:3000>
- Backend API: <http://localhost:8000/api/v1>
- Swagger: <http://localhost:8000/api-docs>
- Prisma Studio: <http://localhost:5555>

### 배포 (Docker)

```bash
# DB 는 infra 레포의 공용 MariaDB — 먼저 ../infra 에서 docker compose up -d
cp .env.example .env
# .env 편집 — DB_PASSWORD (infra/.env 의 DOCNEXUS_DB_PASSWORD 와 같게)

docker compose up -d --build
```

## 기술 스택

- **Frontend**: Next.js 16.2, React 19, TypeScript, Tailwind CSS v4, **TanStack Query(React Query)**
- **Backend**: NestJS 11, Prisma, MariaDB, `@nestjs/throttler`(Rate-limit)
- **인증**: Google OAuth 2.0 + JWT (전역 가드 — 로그인 외 전 엔드포인트 토큰 필수, 새 기기 로그인 감지)
- **암호화**: AES-256-GCM (계정 보관함 민감 필드 — 필드·사용자 문맥(AAD)) / 마스터 잠금 scrypt
- **스토리지**: Backblaze B2 (파일 보관함 — presigned·MIME/매직바이트 검증·SHA-256 중복제거)

## 주요 기능

계정 보관함(비밀번호·TOTP·백업코드, AES) · 파일 보관함(B2) · 가계부/순자산/구독 · 캘린더(일정 + 구독결제·예적금만기·투자계좌만기(ISA 등) 가상 이벤트 연동) · 보안(로그인 기기/세션·마스터 잠금·열람 감사 로그·비번 회전 알림) · 통합 검색·내보내기/가져오기 · 현금흐름 예측·통합 D-day · 시스템 로그(크론·투자 현재가 갱신 등 실행 이력)
