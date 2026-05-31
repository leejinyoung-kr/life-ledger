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
pnpm start:dev        # watch 모드 실행
pnpm build            # 빌드
pnpm test             # 테스트
pnpm prisma:migrate   # DB 마이그레이션
pnpm prisma:studio    # Prisma Studio (포트 5555)
pnpm prisma:seed      # 시드 데이터 삽입
```

## 환경 변수

```env
DATABASE_URL=mysql://root:123456789@localhost:3306/doc_nexus
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
JWT_SECRET=
JWT_REFRESH_SECRET=
CREDENTIAL_SECRET=
CLOUDFLARE_R2_BUCKET=
CLOUDFLARE_R2_ENDPOINT=
CLOUDFLARE_R2_ACCESS_KEY=
CLOUDFLARE_R2_SECRET_KEY=
CLAUDE_API_KEY=
```

## API 문서

개발 서버 실행 후 <http://localhost:8000/api/docs> (Swagger)
