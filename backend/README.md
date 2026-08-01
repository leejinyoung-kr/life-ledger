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
PORT=8000
DATABASE_URL="mysql://root:password@localhost:3306/docnexus"

# Google OAuth2
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_CALLBACK_URL=http://localhost:8000/api/v1/auth/google/callback

# 로그인 허용 이메일(콤마 구분) — 비우면 모든 구글 계정 허용
ALLOWED_EMAILS=

# JWT
JWT_SECRET=your_super_secret_jwt_key_change_this

# 보관함 암호화 (AES-256-GCM) — 계정 비밀번호·신원 번호·ENV 값 암호화 키
# 한 번 정하면 변경 금지(기존 암호문 복호화 불가). 미설정 시 보관함 호출 500.
CREDENTIAL_SECRET=change_this_to_a_long_random_secret

# 파일 보관함 (Backblaze B2 — S3 호환)
B2_ENDPOINT=
B2_BUCKET_REGION=
B2_BUCKET_NAME=
B2_KEY_ID=
B2_APPLICATION_KEY=

# AI (OpenAI)
OPENAI_API_KEY=

# 웹 푸시 (VAPID) — 비우면 푸시 발송 비활성
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:your-real-email@example.com

# SMTP 메일 발송 — 비우면 비활성(이메일 코드 로그인 등에 사용)
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM=DocNexus <no-reply@docnexus.local>

# 리버스 프록시 뒤에서 운영 시 — x-forwarded-for 신뢰 홉 수
TRUST_PROXY=

# App
FRONTEND_URL=http://localhost:3000
CORS_ORIGINS=http://localhost:3000
```

## 모듈 구조

```text
src/
├── auth/          # Google OAuth + JWT 인증 (+ 새 기기 로그인 감지)
├── transaction/   # 수입/지출 내역 (반복 자동생성)
├── saving/        # 예적금
├── investment-account/ # 투자 계좌 (예수금 — 종목 여러 개가 공유)
├── investment/    # 투자 (반복매수 + 현재가 자동 갱신)
├── subscription/  # 구독 서비스
├── asset/         # 자산 (순자산)
├── notification/  # 알림
├── calendar/      # 캘린더
├── security/      # 보안센터 + 마스터 잠금(Vault) + 유출검사·강도통계
├── access-log/    # 보관함 접근 감사 로그 (전역)
├── settings/      # 사용자 설정
├── category/      # 카테고리 관리
├── trash/         # 휴지통
├── search/        # 통합 검색
├── dashboard/     # 대시보드 요약 + 현금흐름 예측 + D-day
├── identity/      # 신원 지갑 (AES + 사본 fileId)
├── credential/    # 계정 보관함 (AES + 백업코드 + 엑셀)
├── env/           # ENV 보관함 (AES + 변경 이력/롤백)
├── file/          # 파일 보관함 (Backblaze B2)
├── export/        # 데이터 내보내기 (JSON/ZIP)
├── import/        # 데이터 가져오기 (계정 JSON 복원)
├── maintenance/   # 스케줄 크론 (알림·휴지통·보안점수·순자산 스냅샷·투자 현재가 갱신)
├── ai/            # AI 리포트 / 자연어 거래 파싱 (사용자별 OpenAI 키)
├── mail/          # SMTP 메일 발송 (이메일 코드 로그인 등)
├── push/          # 웹 푸시 구독/발송 (VAPID)
├── convert/       # 이미지↔PDF 변환
├── system-log/    # 시스템 로그 (크론·투자 갱신 등 백그라운드 작업 실행 기록)
├── health/        # 헬스체크
├── common/        # CryptoService(AES-256-GCM)·ClientInfo 등 공용
└── prisma/        # PrismaService / PrismaModule
```

> 보안 엔드포인트(reveal/totp/복호화)는 `@nestjs/throttler` 로 분당 호출 제한. 마스터 잠금 활성 시 `x-vault-token` 헤더 필요.

## API 문서

개발 서버 실행 후 <http://localhost:8000/api-docs> (Swagger)
