# DocNexus — Backend

NestJS 기반 API 서버

## 실행

```bash
# 의존성 설치 (루트에서)
pnpm install

# 환경 변수 설정
cp ../.env.example .env

# DB 마이그레이션
pnpm prisma:migrate

# 개발 서버 (포트 8000)
pnpm start:dev
```

## 주요 명령어

```bash
pnpm start:dev   # watch 모드 실행
pnpm build       # 빌드
pnpm test        # 테스트
```

## 환경 변수

`.env.example` 참고:

```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=docnexus
PORT=8000
DATABASE_URL="mysql://root:password@localhost:3306/docnexus"

# google OAuth2
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_CALLBACK_URL=http://localhost:8000/api/v1/auth/google/callback
```

## API 문서

개발 서버 실행 후 <http://localhost:8000/api-docs> (Swagger)
