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

## 기술 스택

- **Frontend**: Next.js 16.2, React 19, TypeScript, Tailwind CSS v4
- **Backend**: NestJS 11, Prisma, MariaDB
- **인증**: Google OAuth 2.0 + JWT (전역 가드 — 로그인 외 전 엔드포인트 토큰 필수)
- **암호화**: AES-256-GCM (계정·신원·ENV 보관함 민감 필드)
- **스토리지**: Cloudflare R2 (미구현)
- **AI**: Claude API (미구현)
