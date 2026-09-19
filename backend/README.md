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

전체 목록과 설명은 [.env.example](.env.example), 검증 규칙은 [src/config/env.ts](src/config/env.ts) 참고. 부팅할 때 `@leejinyoun/core-config` 로 검증하고, 틀린 키가 있으면 **전부** 출력한 뒤 부팅을 멈춘다. 성공하면 시크릿을 가린 유효 설정을 부팅 로그(`[Config] 유효 설정`)에 남긴다.

| 구분 | 키 | 규칙 |
| --- | --- | --- |
| 필수 | `FRONTEND_URL`, `DATABASE_URL`, `GOOGLE_*`, `B2_*` | 비면 부팅 실패 |
| 필수 | `ALLOWED_EMAILS` | 콤마 구분, 1개 이상. 목록 밖 계정은 로그인 거부 |
| 필수 | `JWT_SECRET`, `JWT_REFRESH_SECRET`, `JWT_VAULT_SECRET`, `CREDENTIAL_SECRET` | 32자 이상, 예시값 금지, JWT 3개는 서로 달라야 함 (`openssl rand -hex 32`). `CREDENTIAL_SECRET` 은 한 번 정하면 변경 금지(기존 암호문 복호화 불가) |
| 선택 | `SMTP_HOST`·`SMTP_USER`·`SMTP_PASS` | 셋 다 비우면 메일 비활성. 일부만 있으면 부팅 실패 |
| 선택 | `VAPID_PUBLIC_KEY`·`VAPID_PRIVATE_KEY` | 둘 다 비우면 푸시 비활성. 하나만 있으면 부팅 실패 |
| 선택 | `PORT`(8000), `CORS_ORIGINS`(localhost:3000), `TRUST_PROXY`, `BACKUP_DIR`, `HOLIDAY_API_KEY`, `SMTP_PORT`, `SMTP_FROM`, `VAPID_SUBJECT` | 괄호는 기본값 |

코드에서는 `process.env` 대신 `import { env } from '../config/env'` 로 읽는다. 키를 추가·삭제하면 `env.ts` 와 `.env.example` 을 같이 고칠 것 — `src/config/env.spec.ts` 가 어긋나면 테스트를 실패시킨다.

```bash
# 배포 전 점검과 같은 검증만 실행 (빌드 후)
node dist/config/check-env.js
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
├── asset/         # 순자산 요약/추이 (현금+예적금+투자 집계, 전용 테이블 없음)
├── notification/  # 알림
├── calendar/      # 캘린더
├── security/      # 보안센터 + 마스터 잠금(Vault) + 유출검사·강도통계
├── access-log/    # 보관함 접근 감사 로그 (전역)
├── settings/      # 사용자 설정
├── category/      # 카테고리 관리
├── search/        # 통합 검색
├── dashboard/     # 대시보드 요약 + 현금흐름 예측 + D-day
├── identity/      # 신원 지갑 (AES + 사본 fileId)
├── credential/    # 계정 보관함 (AES + 백업코드 + 엑셀)
├── env/           # ENV 보관함 (AES + 변경 이력/롤백)
├── file/          # 파일 보관함 (Backblaze B2)
├── export/        # 데이터 내보내기 (JSON/ZIP)
├── import/        # 데이터 가져오기 (계정 JSON 복원)
├── maintenance/   # 스케줄 크론 (알림·보안점수·순자산 스냅샷·투자 현재가 갱신·소프트삭제 항목 자동정리)
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
