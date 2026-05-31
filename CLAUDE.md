# DocNexus

## 프로젝트 개요

개인 문서·자산·계정 통합 관리 플랫폼.

- 인증: JWT (access/refresh) + Google OAuth2
- 외부 연동: Cloudflare R2 (파일 스토리지), Claude API (AI 리포트)

## 구조

```
doc-nexus/
├── backend/       # NestJS API 서버 (포트 8000)
├── frontend/      # Next.js UI (포트 3000)
├── packages/
│   └── shared/    # @doc-nexus/shared 공통 타입
├── docs/          # 설계 문서
└── docker-compose.yml
```

## 개발 명령어

```bash
pnpm install             # 전체 의존성 설치
pnpm run db              # MariaDB 컨테이너 시작 (포트 3308)
pnpm run dev             # frontend + backend 동시 실행
pnpm run dev:backend     # backend만 실행
pnpm run dev:frontend    # frontend만 실행
pnpm run db:stop         # DB 컨테이너 중지
cd backend && pnpm prisma:migrate   # 마이그레이션
cd backend && pnpm prisma:studio    # Prisma Studio (5555)
```

## 환경 변수

`.env.example` 참고. `backend/.env` 파일 생성 후 값 입력.

```
DATABASE_URL=mysql://root:123456789@localhost:3306/doc_nexus
```

## 기술 스택

- Frontend: Next.js, React, TypeScript, Tailwind CSS v4
- Backend: NestJS, Prisma, MariaDB
- 패키지 매니저: pnpm (모노레포)
- 인증: Google OAuth 2.0 + JWT
- 스토리지: Cloudflare R2 (S3 호환)
- AI: Claude API (`claude-sonnet-4-6`)
