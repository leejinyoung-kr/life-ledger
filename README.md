# DocNexus

개인 문서·자산·계정 통합 관리 플랫폼

## 시작하기

### 요구사항

- Node.js 20+
- pnpm
- Docker

### 설치

```bash
# 의존성 설치
pnpm install

# 환경 변수 설정
cp backend/.env.example backend/.env
# backend/.env 편집 — DATABASE_URL, Google OAuth, JWT_SECRET,
#   CREDENTIAL_SECRET(보관함 암호화 키, 긴 랜덤값) 필수

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
cp .env.example .env
# .env 편집 — MARIADB_ROOT_PASSWORD (backend/.env의 DB_PASSWORD/DATABASE_URL과 동일하게)

docker compose up -d --build
```

## 기술 스택

- **Frontend**: Next.js 16.2, React 19, TypeScript, Tailwind CSS v4, **TanStack Query(React Query)**
- **Backend**: NestJS 11, Prisma, MariaDB, `@nestjs/throttler`(Rate-limit)
- **인증**: Google OAuth 2.0 + JWT (전역 가드 — 로그인 외 전 엔드포인트 토큰 필수, 새 기기 로그인 감지)
- **암호화**: AES-256-GCM (계정·신원·ENV 보관함 민감 필드) / 마스터 잠금 scrypt
- **스토리지**: Backblaze B2 (파일 보관함 — presigned·MIME/매직바이트 검증·SHA-256 중복제거)
- **외부 연동**: HIBP 유출 비밀번호 검사 · tesseract.js 영수증 OCR
- **AI**: OpenAI API (사용자별 키·모델 — AI 리포트, 자연어→거래 파싱)

## 주요 기능

자격증명 관리(계정·ENV·신원, AES) · 파일 보관함(B2) · 가계부/순자산/구독/예산 · 목표 · 보안 코어(마스터 잠금·접근 감사 로그·보안점수 추이·비번 회전·2FA 백업코드·강도 통계·유출 검사) · 통합 검색·내보내기/가져오기 · 현금흐름 예측·통합 D-day · 시스템 로그(크론·투자 현재가 갱신 등 실행 이력)
