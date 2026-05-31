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
cp .env.example backend/.env
# backend/.env 파일 편집

# DB 시작
pnpm run db

# 마이그레이션
cd backend && pnpm prisma:migrate

# 개발 서버 실행
pnpm run dev
```

### 접속

- Frontend: http://localhost:3000
- Backend API: http://localhost:8000/api
- Swagger: http://localhost:8000/api/docs
- Prisma Studio: http://localhost:5555

## 기술 스택

- **Frontend**: Next.js, TypeScript, Tailwind CSS
- **Backend**: NestJS, Prisma, MariaDB
- **인증**: Google OAuth 2.0 + JWT
- **스토리지**: Cloudflare R2
- **AI**: Claude API
