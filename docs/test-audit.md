# LifeLedger — 테스트 점검 (가짜 테스트 찾기)

> **AI 초안 — 2026-10-18. 본인이 diff 를 읽고 확정.**
> 테스트 코드는 AI 가 기능과 같이 만들었고 지금까지 따로 리뷰한 적이 없다. 이 문서는 **각 테스트가 실제로 무엇을 증명하는지**를 assert 기준으로 분류한 것이다 — "통과한다" 와 "무언가를 지켜 준다" 는 다르다.
> 대상: `backend/src/**/*.spec.ts` 30개 · `backend/test/` 2개 · `frontend/__tests__/` 4개 = **36개 파일** (develop, 2026-10-18).

## 실행 결과 (2026-10-18, 개발 PC · Windows)

| 대상 | 명령 | 결과 |
| --- | --- | --- |
| backend 단위 테스트 | `corepack pnpm@12.9.1 -C backend test` (jest) | **31 suites · 284 tests 전부 통과** (61.5s) |
| frontend 단위 테스트 | `corepack pnpm@12.9.1 -C frontend test` (vitest run) | **4 files · 34 tests 전부 통과** (2.8s) |
| backend e2e | `test:e2e` (`test/jest-e2e.json`) | **돌리지 않음** — `AppModule` 전체를 띄워 DB 접속이 필요하고, `pnpm test` 의 `testRegex`(`.spec.ts$`)에도 걸리지 않는다. 지금 CI · 도커 빌드 어디서도 돌지 않는 파일이다 |

## 분류 기준

| 분류 | 뜻 | 예 |
| --- | --- | --- |
| **행동 검증** | 입력을 주고 **결과 값 · 상태 변화 · 던지는 예외**를 본다. 구현을 바꿔도 동작이 같으면 통과 | 매수 뒤 예수금 잔액, 암호문을 실제로 복호화한 값 |
| **구현 세부만 검증** | "어떤 함수를 어떤 인자로 불렀나"(`toHaveBeenCalledWith`)만 본다. 리팩터링하면 깨지고, 그 쿼리가 DB 에서 맞게 도는지는 모른다 | `updateMany` 의 `where` 모양 |
| **mock 만 검증 (가짜 후보)** | mock 이 돌려준 값을 그대로 다시 assert — 실제 로직을 거의 안 탄다 | mock `findMany` 결과를 이름만 바꿔 비교 |
| **소스 문자열 검사 (규칙 테스트)** | 코드 · 설정 파일을 텍스트로 읽어 규칙 위반을 찾는다. 동작이 아니라 규칙을 지킨다 | `process.env` 직접 사용 금지 |

> 공통 전제: backend 서비스 테스트는 거의 전부 **Prisma 를 인메모리 가짜**로 바꾼다. 가짜가 `where` 를 흉내 내 걸러 주므로 "남의 데이터는 NotFound" 같은 테스트는 **서비스가 `user_id` 를 `where` 에 넣었는지**까지는 증명하지만, **실제 Prisma · DB 에서 그 쿼리가 맞게 도는지**는 증명하지 못한다. DB 를 붙이는 통합 테스트는 하나도 없다.

## 1. 파일별 분류

### backend — 보안 · 인증 · 암호화

| 파일 | 무엇을 검증하나 | 분류 | 근거 (어떤 assert 때문에) |
| --- | --- | --- | --- |
| `auth/auth.service.spec.ts` | refresh 토큰 회전 · 폐기, 로그아웃, 로그인 세션 · 새 기기 알림, 용도별 JWT 시크릿 분리, 이메일 코드 발급 상한 · 실패 문구 통일 · 시도 상한 | 행동 검증 (+ 구현 세부 일부) | 「토큰 시크릿 분리」 묶음은 **실제 `JwtService`** 로 서명 · 검증해 refresh 토큰이 access 시크릿으로 안 풀리는지, HS512 위조를 거부하는지 본다. 이메일 코드 실패 문구가 3가지 경우에 같은지 `Set.size === 1` 로 본다. 나머지는 mock 반환값으로 분기를 고르고 `toHaveBeenCalledWith(where …)` 로 확인 — 그 부분은 구현 세부 |
| `security/vault.guard.spec.ts` | 마스터 잠금 가드 — 미설정 · 비활성 통과, 토큰 없음 · 검증 실패 · type 다름 · 남의 토큰 → 423 | 행동 검증 | 실제 `VaultService` 를 감싸 `canActivate` 결과(통과 / `HttpStatus.LOCKED`)를 본다. `jwt.verify` 는 mock 이라 "검증 실패" 는 흉내 |
| `security/vault.service.spec.ts` | 마스터 비번 scrypt 해시 · 8자 미만 거부 · 틀린 비번 거부 · TTL 계산 · salt 매번 다름 | 행동 검증 (가짜 assert 1개) | 실제 scrypt 로 setup → unlock 왕복. 단 `res.token` 이 `'signed-token'` 인지 보는 줄은 mock `sign` 이 돌려준 값 그대로다 (아래 가짜 후보 ⑤) |
| `credential/credential.service.spec.ts` | 계정 비번 · TOTP · 백업코드 암호화 저장과 열람, 감사 로그, 엑셀 입출력 왕복 | 행동 검증 (약한 assert 1개) | **실제 `CryptoService`** 로 저장된 암호문을 `crypto.decrypt(…, cipherContext)` 로 풀어 원문과 비교. 단 「update: 회전일 갱신」은 `>= before` 라 갱신하지 않아도 통과한다 (가짜 후보 ④) |
| `crypto/crypto-audit.service.spec.ts` | 키 교체 재암호화 · 점검(누락 키 · 형식 오류 · 시크릿 오타) · 사용자 문맥 묶기 · 읽은 뒤 수정된 행 건너뛰기 · 부팅 차단 | 행동 검증 | 실제 암호화로 만든 v1 · 이전 키 암호문을 재암호화한 뒤 **이전 키를 뺀 설정으로 다시 복호화**해 같은 값인지 본다. compare-and-swap 은 메모리 저장소가 흉내(`beforeReplace`) |
| `crypto/crypto-fields.spec.ts` | `schema.prisma` 의 암호문 컬럼(`_enc` · 코멘트 "암호문") 목록 = `ENCRYPTED_COLUMNS` = 쓰기 가드 지도 | 소스 문자열 검사 | `schema.prisma` 를 텍스트로 읽어 정규식으로 컬럼을 뽑아 대조. 컬럼을 추가하고 목록을 안 고치면 실패 |
| `import/import.service.spec.ts` | 계정 JSON 백업 복원 — 이메일 문맥 → 사용자 문맥 재암호화, 다른 계정 백업 거부, v1 백업, 2FA 손상 행 거부, 멱등 | 행동 검증 | 실제 암호화로 만든 백업을 복원한 뒤 저장된 값을 복원한 사용자 문맥으로 풀어 비교 |
| `common/demo.spec.ts` | 데모 모드에서 계정 삭제 등을 403 으로 막는다 | 행동 검증 | `ForbiddenException` · 문구 |
| `common/vault.util.spec.ts` | 마스킹 · 날짜 문자열 변환 | 행동 검증 (순수 함수) | 반환 문자열 |
| `push/dto/subscribe.dto.spec.ts` | 푸시 endpoint 허용 패턴 (SSRF 방지 — 내부 주소 · 속임 도메인 거부) | 행동 검증 (순수 정규식) | `test(url)` true/false 표 |
| `config/env.spec.ts` | 환경 변수 스키마 — 예시값 거부, 누락 키 전부 보고, 시크릿 중복 거부, CRYPTO_KEYS 형식, SMTP · VAPID 부분 설정 거부 / `.env.example` 키 일치 / `process.env` 직접 사용 금지 | 행동 검증 + 소스 문자열 검사 | `defineEnv` 실제 실행 결과의 `problems` 배열 비교. 마지막 it 은 `src` 전체를 텍스트로 훑는 규칙 검사 |
| `config/network.spec.ts` | 아웃바운드 연결 대기 시간을 B2 왕복보다 길게 올린다 | 행동 검증 | `node:net` 의 실제 기본값을 읽어 비교 |

### backend — 가계부 · 자산

| 파일 | 무엇을 검증하나 | 분류 | 근거 |
| --- | --- | --- | --- |
| `asset/asset.service.spec.ts` | 순자산 — 자산이동을 현금에서 빼 이중 계산하지 않음, 전월 대비, 추이 마지막 막대 = 지금 값 | 행동 검증 (빈 곳 큼) | `byType` 현금 · `netWorth` 값 비교. 단 가짜 `groupBy` 가 **`where`(date 조건)를 무시**하고 스냅샷은 모두 `cash_total: null` 이라, 실제 운영 경로인 「직전 월말 `cash_total` + 이후 거래 델타」는 한 번도 타지 않는다 |
| `transaction/transaction.service.spec.ts` | 자산이동 거래의 대상 잔액 반영 · 수정 시 차액 재반영 · 대상 변경 · 삭제 역반영 · 일괄 삭제 | 행동 검증 | 예적금 `balance` · 계좌 `cash_balance` 숫자 비교. 가짜 `updateMany` 가 `increment/decrement` 를 흉내 |
| `transaction/recurring.util.spec.ts` | 반복 규칙 — 회차 키, 주말 보정, 말일 클램프, n번째 회차(월 · 연 · 주 · 평일), 월 범위 | 행동 검증 (순수 함수) | 날짜 문자열 비교 |
| `transaction-favorite/transaction-favorite.service.spec.ts` | 즐겨찾기 중복 거부 · 개수 상한 · 순서 변경(남의 id 거부) · 수정 충돌 · 남의 것 삭제 거부 | 행동 검증 | 목록 순서 · 예외 종류 |
| `investment/investment.service.spec.ts` | 매수 · 매도의 예수금 연동, 평균단가 원금 차감, 반복매수 회차 적립(멱등 · 잔액 부족 시 중단 · 주 · 일 주기), 배치 대기 | 행동 검증 | 원금 · 수량 · 예수금 숫자. 시세 조회는 mock(외부 API) |
| `investment-account/investment-account.service.spec.ts` | 계좌번호 암호화 · 마스킹, 보유 종목 집계, 보유 중 삭제 차단, 환전 | 행동 검증 | 실제 암호화 왕복 + 숫자 비교 |
| `recurring-schedule/recurring-schedule.service.spec.ts` | 자동이체 설정 필수값 · 남의 종목 거부 · 토글 · 삭제 | 행동 검증 | 예외 · `active` 값 · 목록 길이 |
| `subscription/billing-date.util.spec.ts` | 결제일 계산 — 말일 클램프 후 원래 결제일 복귀, 윤일, 여러 주기 넘기기, KST 오늘 | 행동 검증 (순수 함수) | 날짜 비교 |
| `subscription/subscription.service.spec.ts` | 구독 요약의 USD 환율 환산 | 행동 검증 | 월 · 연 합계 숫자, KRW 만 있으면 환율 API 미호출 |

### backend — 파일 · 운영

| 파일 | 무엇을 검증하나 | 분류 | 근거 |
| --- | --- | --- | --- |
| `file/file.service.spec.ts` | 업로드 MIME 매직바이트 검증, 파일명 NFC, DB 실패 시 B2 보상 삭제, 다운로드 inline XSS 차단 · 한글 파일명 헤더, 폴더 재귀 삭제, 폴더째 업로드, 검색 위치, ZIP · 비우기 계획 | 행동 검증 + 구현 세부 | 업로드 · 다운로드는 실제 `StorageService`(core-storage) 검증 로직을 타고 S3 `send` 만 가짜 — 거부 예외 · `ResponseContentDisposition` 값을 본다. 「재귀삭제 단일 트랜잭션」은 `$transaction` 호출 횟수와 `updateMany` 인자 모양 → 구현 세부 |
| `file/file-path.util.spec.ts` | 폴더 경로 · 하위 폴더 수집 · 금지 문자 치환 · 이름 겹침 번호 · ZIP 상대 경로 | 행동 검증 (순수 함수) | 반환 값 |
| `file/file-text.util.spec.ts` | 텍스트 미리보기 판별 · 잘린 UTF-8 조각 · EUC-KR 판별 | 행동 검증 (순수 함수) | 반환 값 |
| `maintenance/db-backup-cron.service.spec.ts` | DB URL 분해, 덤프 → gzip 파일, 실패 시 쓰다 만 파일 삭제, 30일 지난 백업 정리 | 행동 검증 | **실제 임시 폴더**에 파일을 쓰고 `gunzip` 해서 내용 비교, `utimes` 로 날짜를 바꿔 정리 결과 확인. `mariadb-dump` 만 대역 |
| `maintenance/job-run.store.spec.ts` | 예약 작업 실행 기록 — 시작 기록, 유니크 충돌(P2002) → 이미 실행 중, running 행만 마감, 실패 시 시스템 로그, lease 만료 조회 | 구현 세부 (+ 행동 일부) | 대부분 `create` · `updateMany` · `findMany` 의 **인자를 통째로 비교**. P2002 → `null`, `count: 0` → `false` 분기는 행동. "같은 작업 동시 실행 차단"의 실체인 `running_key` UNIQUE 는 DB 가 하므로 증명하지 못한다 (가짜 후보 ①) |
| `push/outbox.store.spec.ts` | 알림 아웃박스 — 호출부 트랜잭션에 적재, 멱등키 충돌 → false, pending 만 선점, 재시도 · 마감, 선점 만료 복구 | 구현 세부 (+ 행동 일부) | `updateMany({ where: { id, status: 'pending' } … })` 같은 **인자 모양** 비교가 중심. "트랜잭션 밖으로 새지 않는다"(`prisma.create` 미호출), 선점 `count: 0` 행 제외는 행동 (가짜 후보 ②) |
| `push/webpush.channel.spec.ts` | 기기별 발송 결과에 따른 재시도 판단 — 만료 구독 삭제, 하나라도 성공이면 성공, 전부 실패면 던짐, 푸시 꺼짐은 영구 실패 | 행동 검증 | resolve / reject · 예외 종류 |
| `meta/jobs.meta.spec.ts` | `/_meta` 작업 구역 — 마지막 실행 · 성공 합치기, 실패 경고, 성공한 적 없음 경고, 첫 실행 전은 경고 안 함 | 행동 검증 | 경고 문자열 · 경과 시간 계산. mock 은 입력 데이터만 준다 |
| `meta/outbox.meta.spec.ts` | `/_meta` 아웃박스 구역 — 상태별 0 채움, 마감 경고, 오래 밀린 대기 경고, 선점 만료 경고 | 행동 검증 | 위와 같음 |
| `test/app.controller.spec.ts` | `GET /` 가 `'Hello World!'` | 구현 세부 — **Nest 템플릿 잔재** | 앱 기능과 무관한 기본 컨트롤러 (가짜 후보 ⑥) |
| `test/app.e2e-spec.ts` | 앱 전체를 띄워 `GET /` | **실행되지 않음** — Nest 템플릿 잔재 | `pnpm test` 에 안 걸리고 DB 가 있어야 뜬다 (가짜 후보 ⑦) |

### frontend

| 파일 | 무엇을 검증하나 | 분류 | 근거 |
| --- | --- | --- | --- |
| `__tests__/lib/credential.test.ts` | 비밀번호 강도 점수 · 날짜 표시 | 행동 검증 (순수 함수) | `pct` · `tone` 값 |
| `__tests__/lib/finance.test.ts` | 금액 표시(₩ · 부호), 날짜 표시, D-day, 이번 달, 반복 규칙 요약 문구 | 행동 검증 (순수 함수) | 반환 문자열 · 숫자. 「과거 날짜 → 음수」는 `< 0` 만 본다 (값까지 볼 수 있음) |
| `__tests__/lib/folderUpload.test.ts` | 폴더째 업로드 — 상대 경로, OS 숨김 파일 제외, 50MB 초과 분리, 드롭한 폴더 안까지 내려가기 | 행동 검증 (순수 함수) | 반환 목록 |
| `__tests__/ui-conventions.test.ts` | 공통 UI 규칙 — h1 은 PageHeader 안에만, 체크박스 클래스, 토큰 유틸, SearchInput · TableEmptyRow 사용, 직접 적은 빨간색 금지 | 소스 문자열 검사 | `app` · `components` 의 `.tsx` 를 줄 단위 정규식으로 훑어 위반 위치 목록이 비었는지 |

### 분류 합계

| 분류 | 파일 수 |
| --- | --- |
| 행동 검증 (주로) | 30 (backend 27 · frontend 3) — 섞인 파일(`env.spec` 행동+규칙, `file.service` · `auth.service` 행동+구현 세부)은 행동 쪽으로 셈 |
| 구현 세부가 중심 | 3 (`job-run.store` · `outbox.store` · `test/app.controller`) |
| 소스 문자열 검사 (규칙 테스트) | 2 (`crypto-fields` · `ui-conventions`) |
| 실행되지 않음 | 1 (`test/app.e2e-spec`) |
| 합계 | 36 |

행동 검증 파일 안에도 가짜 · 약한 assert 가 섞여 있다 — 아래 ③ ④ ⑤.

## 2. 가짜 테스트 후보

"테스트가 없어도 같은 결과" 이거나 "로직이 틀려도 통과" 하는 것들이다. 지우라는 뜻이 아니라 **무엇을 증명하지 못하는지** 적는다.

| # | 위치 | 왜 가짜 후보인가 | 고치면 무엇을 검증해야 하나 |
| --- | --- | --- | --- |
| ① | `maintenance/job-run.store.spec.ts` 「lease 가 지난 running 행을 찾는다」 · 「시작을 running 으로 기록」 | mock `findMany` 가 돌려준 행을 필드 이름만 바꿔(`started_at` → `startedAt`) 그대로 비교하고, 쿼리는 인자 모양만 본다. 시작 기록도 `create` 인자를 통째로 비교 | 실제 DB(테스트용 MariaDB)에 행을 넣고 ⓐ lease 가 지난 running 만 나오는지 ⓑ 같은 작업을 두 번 `start` 하면 두 번째가 `null` 인지 — **`running_key` UNIQUE 가 동시 실행을 막는다**는 것이 이 저장소의 핵심인데 지금은 P2002 를 mock 으로 던질 뿐이다 |
| ② | `push/outbox.store.spec.ts` 「선점 만료만 대기로 되돌린다」 · 「발송 성공은 sending 인 행만 sent 로」 · 「재시도는 pending 으로 되돌리고」 | `updateMany` 가 `count: 2` 를 돌려주게 해 놓고 `toBe(2)` 를 확인하고, 나머지는 `where` · `data` 인자 모양 비교. "sending 인 행만" 이라는 규칙이 실제로 지켜지는지는 DB 가 한다 | 실제 DB 에 pending · sending · sent 행을 섞어 넣고, 각 메서드 뒤 **상태가 바뀐 행과 안 바뀐 행**을 조회해 비교. 멱등키 UNIQUE 로 같은 알림이 두 번 적재되지 않는지도 |
| ③ | `asset/asset.service.spec.ts` 전체 | 가짜 `groupBy` 가 `where` 를 무시해 **date 조건이 틀려도 통과**한다. 모든 스냅샷이 `cash_total: null` 이라 운영에서 실제로 도는 "스냅샷 + 델타" 분기를 안 탄다. 2026-10-14 커밋 "순자산 이중 계산과 스냅샷 이름표 밀림" 을 고친 곳인데 경계(다음 달 1일 `lt` / `gte`)는 검증 없음 | 가짜 `groupBy` 가 `date.gte` · `date.lt` 를 적용하게 바꾸고 ⓐ `cash_total` 이 있는 스냅샷 + 그 이후 거래만 더하는지 ⓑ 월말 · 월초 경계 거래가 한 번만 세지는지 ⓒ `cashTotalForSnapshot(month)` 이 그 달 말까지만 세는지 |
| ④ | `credential/credential.service.spec.ts` 「update: 새 비번 주면 재암호화 + 회전일 갱신」 | `expect(after).toBeGreaterThanOrEqual(before)` — `password_changed_at` 을 **갱신하지 않아도** 같은 값이라 통과한다 (앞에 5ms 기다리는 줄이 있어 의도는 `>` 였던 것으로 보인다) | `toBeGreaterThan(before)`, 그리고 비번 없이 메모만 고쳤을 때는 회전일이 **그대로**인지(90일 회전 알림이 리셋되지 않게) |
| ⑤ | `security/vault.service.spec.ts` 「unlock: 올바른 비번이면 토큰 + 만료시간」의 `res.token` 줄 · `auth/auth.service.spec.ts` 「정상 → rotation 후 새 access/refresh」의 `out.access` · `out.refresh` 줄 | mock `sign` 이 돌려준 문자열(`'signed-token'`, `'tok:access:7'`)을 그대로 비교 — 서비스가 그 값을 통과시키는지만 본다. 같은 it 의 다른 assert(`sign` 인자 · 만료 초 · 폐기 호출)는 의미가 있다 | 실제 `JwtService` 로 서명해 `verify` 했을 때 `type: 'vault'` · `sub` · 만료가 맞는지 (auth 쪽은 「토큰 시크릿 분리」 묶음이 이미 이렇게 한다 — 같은 방식으로) |
| ⑥ | `test/app.controller.spec.ts` | Nest 프로젝트 생성 때 따라온 "Hello World" 테스트. 앱 기능을 지키지 않는다 | 지우거나, 그 자리를 헬스체크(`health/health.controller.ts`)처럼 실제로 쓰는 엔드포인트로 바꾼다 |
| ⑦ | `test/app.e2e-spec.ts` | 어떤 명령으로도 돌지 않는다(`pnpm test` 범위 밖, CI · 도커 빌드에 없음). 통과하는지조차 모른다 | 쓸 거면 테스트용 DB 를 띄워 전역 가드(로그인 없이 401) · `@Public` 예외를 보는 e2e 로, 아니면 삭제 |

## 3. 테스트가 없는 중요한 흐름

"돈 · 비밀 · 접근" 에 닿는 것 위주로 골랐다. 표의 "현재" 는 이 레포 안 기준이다.

| 흐름 | 코드 | 현재 | 왜 중요한가 |
| --- | --- | --- | --- |
| 전역 JWT 가드 + `@Public` 예외 — 로그인 없이 열린 엔드포인트가 없는지 | `app.module.ts:97`, 각 컨트롤러 | 컨트롤러 테스트 0개 · e2e 미실행 | 데코레이터 하나 잘못 붙이면 보관함 API 가 열린다 |
| refresh 쿠키 속성(`httpOnly` · `SameSite=Lax`) | `auth/auth.controller.ts:43`~`:58` | 없음 | 2026-10-09 CSRF 수정 지점 — 되돌아가도 테스트가 못 잡는다 |
| 구글 로그인의 `ALLOWED_EMAILS` 거부 | `auth/auth.module.ts:23` → core-auth | 이 레포엔 없음 (이메일 코드 쪽만 있음) | 화이트리스트가 유일한 접근 제한이다. core-auth(young-core) 쪽 테스트가 있는지 확인 필요 |
| Rate limit(`@Throttle`) — 비번 열람 · TOTP · 보관함 잠금해제 | `credential/credential.controller.ts` 등 6곳 | 없음 | 무차별 대입 방어 |
| 암호문 컬럼 쓰기 가드 — 평문이 `_enc` 컬럼에 저장되지 않는지 | `prisma/prisma.service.ts` (core-security `encryptedFields`) | 없음 (`crypto-fields.spec` 은 목록 대조만) | 가드가 빠지면 평문 비번이 DB 에 그대로 남는다 |
| 데이터 내보내기 — 계정 JSON 의 이메일 문맥 암호화 · 전체 ZIP | `export/export.service.ts` | 없음 (복원 쪽 `import` 만 있음) | 내보내기 → 가져오기 왕복이 깨지면 백업이 쓸모없어진다 |
| 순자산 월말 스냅샷 + 현금 델타 | `maintenance/net-worth-snapshot-cron.service.ts`, `asset/asset.service.ts:66` | 크론 테스트 없음 · 델타 경로 미검증 (가짜 후보 ③) | 대시보드 첫 숫자. 이중 계산 버그가 실제로 있었던 곳 |
| 가계부 목록 · 월 요약 · 월별 추이 합계 | `transaction/transaction.service.ts:243`~`:322` | 없음 (자산이동 잔액만 있음) | 화면의 수입 · 지출 · 잔액 숫자 |
| 반복거래 회차 생성 (멱등 · 시작일 이전 회차 제외 · 자산이동 일괄 반영) | `transaction/transaction.service.ts:148`~`:203` | 없음 (순수 함수 `recurring.util` 만) | 매일 크론이 돈다 — 두 번 생성되면 돈이 두 번 빠진다. 반복매수 쪽(`investment`)은 테스트가 있다 |
| 가계부 엑셀 가져오기 · 내보내기 | `transaction/transaction.service.ts:354`, `:448` | 없음 (계정 엑셀만 있음) | 대량 입력 경로 |
| 알림 크론 — 만기 · 결제 D-day 정확히 그날만, 같은 제목 미읽음이면 건너뜀 | `maintenance/notification-cron.service.ts` | 없음 | 매일 반복 알림 · 누락 |
| 알림 + 푸시 한 트랜잭션 (`createWithPush`) | `notification/notification.service.ts` | 없음 (아웃박스 저장소만) | 롤백 시 푸시가 나가지 않아야 한다 |
| 세션 강제 로그아웃 — refresh 폐기 + 그 기기 푸시 삭제 | `security/security.service.ts:36`~`:70` | 없음 (로그아웃 쪽은 있음) | 2026-10-15 수정("로그아웃한 기기로 알림이 가지 않게") 지점 |
| 캘린더 반복 · 음력 일정 펼치기 | `calendar/calendar.service.ts` | 없음 | 음력 변환 · 윤달 · 반복 종료일 경계 |
| 구독 결제일 넘기기 크론 · 휴지통 영구삭제 크론 | `maintenance/subscription-cron.service.ts`, `trash-cron.service.ts` | 없음 (결제일 유틸만) | 매일 데이터를 바꾸거나 지운다 |
| 대시보드 현금흐름 예측 · 통합 D-day | `dashboard/dashboard.service.ts` | 없음 | 주기 환산(주 52/12 · 평일 261/12) |
| frontend API 클라이언트 — 401 이면 refresh 한 번 · 동시 401 공유 | `frontend/lib/api.ts:34`~`:50` | 없음 (vitest 는 `lib` 순수 함수만) | 토큰 만료 때 무한 재시도 · 중복 refresh |
| DB 에 의존하는 규칙 전체 — UNIQUE(`running_key` · `idempotency_key` · `holiday(date,name)` · `net_worth_snapshot(user_id,month)`) | — | 통합 테스트 0개, P2002 는 mock | 이 규칙들은 코드가 아니라 DB 제약이 지킨다 |

## 4. 같이 본 CI 단계 결과 (로컬, 2026-10-18)

[`.github/workflows/ci.yml`](../.github/workflows/ci.yml) 이 돌릴 단계를 개발 PC 에서 같은 명령으로 돌렸다. 앱 코드는 고치지 않았다.

| 단계 | backend | frontend |
| --- | --- | --- |
| lint | **실패** — `eslint "{src,apps,libs,test}/**/*.ts"`(고치지 않고 검사) **1,996 문제 (오류 1,873 · 경고 123)**. 오류 중 prettier 서식 1,049 · `no-unsafe-*` 715(대부분 spec 의 `any` 가짜 객체) · `require-await` 60 · `no-unnecessary-type-assertion` 41 · 기타 8. spec 파일 1,095 · 소스 778(서식 제외 소스 오류는 55) | 통과 (경고 · 오류 0) |
| build | 통과 — `nest build`(SWC) 187 파일. **SWC 는 타입 검사를 하지 않는다** (따로 돌린 `tsc --noEmit` 은 통과) | 통과 — `next build` (TypeScript 검사 포함) |
| test | 통과 — 31 suites · 284 tests | 통과 — 4 files · 34 tests |

backend lint 가 지금까지 드러나지 않은 이유: `package.json` 의 `lint` 스크립트가 `--fix` 로 돌고, 도커 빌드(`backend/Dockerfile`)에는 lint 단계가 없다(frontend 는 있다). CI 는 이 상태 그대로 실패한다 — 서식은 `pnpm lint`(--fix) 한 번으로 1,090개가 고쳐지고, 나머지는 손으로 봐야 한다.
