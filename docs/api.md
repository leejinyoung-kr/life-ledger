# DocNexus — API 명세

Base URL: `http://localhost:8000/api/v1`

> 상세 문서: Swagger UI → <http://localhost:8000/api-docs>

## 인증

| Method | Endpoint | 설명 |
| --- | --- | --- |
| GET | /auth/google | Google OAuth 로그인 리다이렉트 (`@Public`) |
| GET | /auth/google/callback | OAuth 콜백, JWT 발급 후 프론트엔드로 리다이렉트 (`@Public`) |
| GET | /auth/me | 현재 로그인 사용자 정보 (name/email/picture) |
| DELETE | /auth/me | 계정 영구 삭제 (전 도메인 데이터 + user 삭제) |
| POST | /auth/email/request | 이메일 인증코드 요청 (`@Public`, `ALLOWED_EMAILS` 화이트리스트 대조, SMTP 발송) |
| POST | /auth/email/verify | 이메일 인증코드 검증 → JWT 발급 (`@Public`) |
| POST | /auth/refresh | refresh 쿠키로 새 access 발급 (`@Public`) |
| POST | /auth/logout | refresh 쿠키 제거 (`@Public`) |
| GET | /auth/dev-login | 로컬 개발용 원클릭 로그인, 고정 유저(`dev@local`)로 즉시 JWT 발급 (`@Public`, `NODE_ENV=production`에서는 404) |

> 토큰: **Access(15분)** 는 `?token=` 으로 전달 → localStorage → `Authorization: Bearer`.
> **Refresh(7일)** 는 httpOnly 쿠키(`refresh_token`)로만 저장. access 만료(401) 시 프론트가 `/auth/refresh` 1회 호출해 갱신·재요청.
> 전역 JWT 가드 — 로그인 관련(`@Public()`) 외 **모든** 엔드포인트는 access 토큰 필수.

## 가계부 — 수입/지출

| Method | Endpoint | 설명 |
| --- | --- | --- |
| GET | /transactions?from=&to=&type=&category=&q=&page=&limit= | 내역 목록 (날짜범위/유형/카테고리/검색 필터, `page` 지정 시 서버 페이징) |
| GET | /transactions/summary?month= | 월 요약 (수입/지출/저축이동/실소비/잔액) |
| GET | /transactions/monthly-trend?month= | 월별 지출 추이 (최근 5개월) |
| POST | /transactions | 내역 추가 (`type='transfer'`이고 `targetType`·`targetId` 지정 시 대상 잔액에 자동 반영) |
| POST | /transactions/import | 엑셀 양식(.xlsx) 업로드 → 행별 검증 후 일괄 추가 (multipart, 필드명 `file`, 최대 5MB) |
| GET | /transactions/export?from=&to=&type=&category=&q= | 현재 필터 내역을 .xlsx 로 스트리밍 다운로드 |
| PUT | /transactions/:id | 내역 수정 |
| DELETE | /transactions/:id | 내역 삭제 (soft delete) |

> 반복거래/반복매수는 이 엔드포인트가 아닌 [자동이체 설정](#자동이체-설정) API에서 별도로 등록/관리한다 — 거래·투자 등록은 항상 순수 데이터 생성만 한다.

> 목록 응답(페이징 시): `{ items, total, page, limit, sumIncome, sumExpense, sumTransfer }` — 합계는 현재 페이지가 아닌 필터 전체 기준.

> **엑셀 양식 컬럼** (화면 테이블 순서): `유형` · `카테고리` · `내역` · `금액` · `날짜` (필수) / `결제수단` (지출일 때만 필수) / `메모` (선택)
> 유형·카테고리는 한글 라벨로 입출력하며 업로드 시 코드로 역매핑된다. 양식 다운로드는 프론트(exceljs)에서 생성한다.
> import 응답: `{ imported, failed, errors: [{ row, message }] }` — 검증 실패 행은 건너뛰고 정상 행만 등록(부분 성공).

## 가계부 — 예적금

| Method | Endpoint | 설명 |
| --- | --- | --- |
| GET | /savings | 예적금 목록 |
| GET | /savings/summary | 요약 (총 잔액/이번 달 납입/평균 금리/만기 임박) |
| POST | /savings | 예적금 추가 |
| PUT | /savings/:id | 예적금 수정 |
| DELETE | /savings/:id | 예적금 삭제 (soft delete) |

## 가계부 — 투자 계좌

예수금은 계좌(InvestmentAccount) 단위로 보유하며, 한 계좌에 속한 여러 종목이 예수금을 공유한다(ISA 등).

| Method | Endpoint | 설명 |
| --- | --- | --- |
| GET | /investment-accounts | 계좌 목록 (계좌명 검색 + 페이지네이션) |
| GET | /investment-accounts/summary | 요약 (총 예수금/계좌 수) |
| POST | /investment-accounts | 계좌 추가 |
| PUT | /investment-accounts/:id | 계좌 수정 |
| DELETE | /investment-accounts/:id | 계좌 삭제 (soft delete) |

## 가계부 — 투자

| Method | Endpoint | 설명 |
| --- | --- | --- |
| GET | /investments?accountId=&type=&q= | 투자 목록 (수익/수익률 파생값 포함, 계좌/유형/종목명 필터) |
| GET | /investments/summary | 요약 (총 평가금액/원금/수익/수익률) |
| GET | /investments/exchange-rate | 현재 USD/KRW 환율 (해외투자 USD 표기 토글용) |
| POST | /investments | 투자 추가 (`accountId` 필수 — 소속 계좌) |
| PUT | /investments/:id | 투자 수정 |
| POST | /investments/:id/buy | 매수 — 소속 계좌 예수금 → 투자원금·평가금액 전환 |
| POST | /investments/:id/sell | 매도 — 평가금액 → 소속 계좌 예수금 환입 |
| DELETE | /investments/:id | 투자 삭제 (soft delete) |

## 자동이체 설정

반복거래(수입/지출/자산이동)·반복매수(주식모으기) 자동 생성 규칙. 거래/투자 등록 폼과 분리된 전용 CRUD — 저장 시 데이터를 즉시 생성하지 않고, `RecurringCronService`가 매일 규칙에 따라 순수 생성만 한다.

| Method | Endpoint | 설명 |
| --- | --- | --- |
| GET | /recurring-schedules?kind= | 자동이체 설정 목록 (`kind=transaction`\|`investment` 필터) |
| POST | /recurring-schedules | 자동이체 설정 추가 (`kind`에 따라 거래/투자 전용 필드 사용) |
| PUT | /recurring-schedules/:id | 자동이체 설정 수정 |
| PATCH | /recurring-schedules/:id/toggle | 활성/일시정지 토글 |
| DELETE | /recurring-schedules/:id | 자동이체 설정 삭제 (soft delete — 이미 생성된 거래/매수 내역은 유지) |

> `kind=transaction`: `txType`·`title`·`category`·`amount`·`payMethod`·`memo`·`targetType`·`targetId` 사용. 생성된 회차는 `Transaction.recurring_schedule_id`로 연결되며, `recurring_period`로 중복 생성을 막는다(idempotent).
> `kind=investment`: `investmentId`(대상 종목, symbol 필수)·`buyAmount` 또는 `buyQuantity`(상호배타) 사용. 크론이 해당 종목 행을 직접 누적 갱신한다(신규 거래 행을 만들지 않음).
> 공통: `rule`(cycle/day/month/weekendAdjust) · `startDate`(최초 실행 기준일) · `active`(false면 새 회차를 생성하지 않음). 응답에는 `nextRunDate`(다음 실행 예정일)가 함께 내려온다.

## 구독 관리

| Method | Endpoint | 설명 |
| --- | --- | --- |
| GET | /subscriptions | 구독 목록 |
| GET | /subscriptions/summary | 요약 (월 총액/연 총액/구독 수) |
| POST | /subscriptions | 구독 추가 |
| PUT | /subscriptions/:id | 구독 수정 |
| DELETE | /subscriptions/:id | 구독 삭제 (soft delete) |

## 순자산 (자산)

| Method | Endpoint | 설명 |
| --- | --- | --- |
| GET | /assets/summary | 순자산 요약 (현금+예적금+투자 집계) |
| GET | /assets/trend | 순자산 추이 (NetWorthSnapshot) |

## 알림

| Method | Endpoint | 설명 |
| --- | --- | --- |
| GET | /notifications | 알림 목록 |
| GET | /notifications/unread-count | 미읽음 알림 수 (상단 종 배지) |
| PUT | /notifications/:id/read | 단건 읽음 처리 |
| PUT | /notifications/read-all | 전체 읽음 처리 |
| DELETE | /notifications/bulk | 선택 일괄 삭제 |
| DELETE | /notifications | 전체 삭제 |

> 알림 자동생성 크론(매일 9시): 예적금·투자계좌 만기(D-30/14/7/1)·구독결제/체험종료(D-7/3/1)·신원만료(D-60/30/14/7/1)·비번회전(90일 경과 후 30일 간격 재알림). `notif_maturity`·`notif_deadline` 설정으로 게이팅.
> 캘린더 자체는 별도 알림 크론이 없다 — 대시보드 "다가오는 일정" 위젯으로 노출.

## 캘린더

| Method | Endpoint | 설명 |
| --- | --- | --- |
| GET | /calendar | 이벤트 목록 (실제 + 구독결제·예적금만기·투자계좌만기(ISA 등)·신원만료·공휴일 가상 이벤트) |
| GET | /calendar/upcoming | 다가오는 이벤트 |
| POST | /calendar | 이벤트 생성 (양력/음력, 음력은 매년 반복만 지원) |
| PUT | /calendar/:id | 이벤트 수정 |
| DELETE | /calendar/:id?occurrenceDate=YYYY-MM-DD | 이벤트 삭제 (soft delete, 가상 이벤트는 원본 테이블 soft delete — 단 투자계좌만기는 계좌 자체가 아니라 `maturity_date`만 초기화, 공휴일은 삭제 불가). 반복 이벤트에서 `occurrenceDate`(클릭한 회차 날짜) 지정 시 그 회차부터 이후 반복만 중단(`recur_until` 조정)하고 이전 회차는 유지 — 첫 회차 지정 시 전체 삭제와 동일 |

> 공휴일 표시: `UserSettings.show_holidays` 켜져 있을 때만 응답에 포함. 공공데이터포털 특일 정보 API를 연도 단위로 캐싱(`HOLIDAY_API_KEY` 미설정 시 비활성).

## 보안

| Method | Endpoint | 설명 |
| --- | --- | --- |
| GET | /security/summary | 보안 요약 (실시간 분석 — 점수·카테고리 건수) |
| GET | /security/risks | 위험 목록 (계정별 reuse/weak/no2fa + credentialId 딥링크) |
| GET | /security/sessions | 로그인 세션 목록 |
| POST | /security/sessions/:id/revoke | 세션 단건 차단 |
| POST | /security/sessions/revoke-all | 전체 세션 차단 |
| GET | /security/score-trend?days= | 보안 점수 추이 (일별 스냅샷) |
| GET | /security/access-logs?limit= | 최근 보관함 열람 기록 |
| GET | /security/strength-stats | 비밀번호 강도 분포 (강함/보통/취약) |
| GET | /security/breach-check | 유출 비밀번호 검사 (HIBP k-anonymity, throttle 6/분) |
| GET | /security/vault | 마스터 잠금 상태 |
| POST | /security/vault/setup | 마스터 잠금 설정/변경 (비번 scrypt 해시) |
| POST | /security/vault/disable | 마스터 잠금 해제 (현재 비번 확인) |
| POST | /security/vault/unlock | 잠금 해제 — vault 토큰 발급 (throttle 5/분) |

> **마스터 잠금**: 켜지면 reveal/totp/백업코드/신원/ENV 열람 시 `x-vault-token` 헤더 필요(없으면 423 + `code:VAULT_LOCKED`). 자동잠금 = 토큰 만료.
> **Rate-limit**(`@nestjs/throttler`): 전역 120/분, reveal·totp·신원·ENV·백업코드 20/분, vault unlock 5/분.

## 설정

| Method | Endpoint | 설명 |
| --- | --- | --- |
| GET | /settings | 사용자 설정 조회 |
| PUT | /settings | 사용자 설정 수정 |

> soft delete된 항목(가계부/예적금/투자/구독/캘린더/계정/신원/ENV)은 30일 경과 시 자동 영구삭제 크론(매일 3시)이 정리한다. 별도 복원 UI는 없다.

## 카테고리 관리

| Method | Endpoint | 설명 |
| --- | --- | --- |
| GET | /categories?domain= | 카테고리 목록 (도메인 필터 선택) |
| POST | /categories | 카테고리 추가 (`parentCode` 주면 소분류, 없으면 대분류) |
| POST | /categories/seed?domain= | 기본 카테고리 시드 (도메인 미지정 시 전체) |
| PATCH | /categories/:id | 카테고리 수정 (label·parentCode·sortOrder·isActive) |
| DELETE | /categories/:id | 카테고리 삭제 |

> 가계부(`transaction`) 도메인은 2계층: 응답에 `parentCode`(대분류 code, 대분류면 null) 포함. 거래는 소분류 code 만 저장. 상세: [category-migration.md](category-migration.md)

## 통합 검색

| Method | Endpoint | 설명 |
| --- | --- | --- |
| GET | /search?q= | 거래·계정·신원·ENV 통합 검색 (타입별 최대 5건, 암호화 컬럼 제외) |

## 대시보드

| Method | Endpoint | 설명 |
| --- | --- | --- |
| GET | /dashboard/summary | 요약 — 이번 달 수입/지출·순자산·활성구독 + 최근 거래·다가오는 일정 |
| GET | /dashboard/cashflow-forecast | 현금흐름 예측 — 활성 구독 + 반복 지출거래 월 환산·합산 |
| GET | /dashboard/deadlines | 통합 D-day — 신원만료·예적금만기·투자계좌만기(ISA 등)·구독결제 임박순 |

## 신원 지갑

| Method | Endpoint | 설명 |
| --- | --- | --- |
| GET | /identities | 신원 문서 목록 (번호는 마스킹) |
| GET | /identities/:id/reveal | 번호 원문 복호화 |
| POST | /identities | 신원 문서 추가 (번호 AES 암호화, `fileId` 로 사본 연결) |
| PUT | /identities/:id | 수정 (`number` 전달 시 재암호화, `fileId` 로 사본 변경/해제) |
| DELETE | /identities/:id | 삭제 (soft delete) |

> `type`: passport / idcard / license / cert / etc · 사본 이미지는 파일 보관함(B2) 업로드 후 `fileId` 연결, 조회는 `/files/:id/url?disposition=inline`

## 계정 보관함

| Method | Endpoint | 설명 |
| --- | --- | --- |
| GET | /credentials | 계정 목록 (비번 제외 — `has2fa`·`hasBackupCodes`·`passwordChangedAt` 노출) |
| GET | /credentials/:id/reveal | 비밀번호·TOTP 원문 복호화 (감사 로그 기록) |
| GET | /credentials/:id/totp | 현재 6자리 TOTP 코드 + 남은 시간 |
| GET | /credentials/:id/backup-codes | 2FA 백업코드 조회 |
| POST | /credentials/:id/backup-codes | 2FA 백업코드 생성 (평문 1회 반환) |
| DELETE | /credentials/:id/backup-codes | 백업코드 삭제 |
| GET | /credentials/template | 엑셀 양식(.xlsx) 다운로드 |
| GET | /credentials/export | 계정 엑셀 다운로드 (비밀번호 평문 — 본인 백업) |
| POST | /credentials | 계정 추가 (비번·TOTP AES 암호화) |
| POST | /credentials/import | 엑셀 업로드 → 일괄 추가 (multipart `file`) |
| PUT | /credentials/:id | 수정 (`password`/`totp` 전달 시 재암호화) |
| DELETE | /credentials/bulk | 선택 일괄 삭제 |
| DELETE | /credentials/:id | 삭제 (soft delete) |

> reveal/totp/backup-codes 는 마스터 잠금 시 `x-vault-token` 필요 + 분당 20회 제한.

## ENV 보관함

| Method | Endpoint | 설명 |
| --- | --- | --- |
| GET | /env-projects | 프로젝트 목록 (환경별 변수 개수 포함) |
| POST | /env-projects | 프로젝트 추가 |
| PUT | /env-projects/:id | 프로젝트 수정 |
| DELETE | /env-projects/:id | 프로젝트 삭제 (하위 변수 포함 soft delete) |
| GET | /env-projects/:id/vars?env=&location= | 환경별 변수 목록 (값 마스킹, location 지정 시 해당 위치만) |
| GET | /env-projects/:id/locations | 프로젝트에서 이미 쓰인 위치 목록 (자동완성용) |
| GET | /env-projects/:id/diff?base=&target= | 두 환경 비교 (누락·값 불일치) |
| GET | /env-projects/:id/export?env=&location= | 환경 변수 원문 내보내기 (.env 복사/다운로드용, location 지정 시 해당 위치만) |
| POST | /env-projects/:id/vars | 변수 추가 (선택 환경마다 생성, 값 AES 암호화) |
| POST | /env-projects/:id/bulk | .env 텍스트 일괄 파싱 저장 |
| GET | /env-vars/:id/reveal | 변수 값 원문 복호화 (감사 로그 기록) |
| GET | /env-vars/:id/history | 값 변경 이력 (마스킹) |
| POST | /env-vars/:id/rollback/:historyId | 이력 값으로 롤백 |
| PUT | /env-vars/:id | 변수 수정 (`value` 변경 시 재암호화 + 이전값 이력 적재) |
| DELETE | /env-vars/bulk | 선택 일괄 삭제 |
| DELETE | /env-vars/:id | 변수 삭제 (soft delete) |

> `env`: dev / prod

## 데이터 내보내기

| Method | Endpoint | 설명 |
| --- | --- | --- |
| GET | /export/credentials | 계정 JSON 백업 (비번/TOTP 암호문 보존) |
| GET | /export/backup | 전체 데이터 ZIP (도메인별 JSON) |

> 암호화 컬럼은 평문으로 풀지 않고 암호문(`v2:<키ID>:...`)으로 내보낸다. 계정 JSON 백업은 사용자 id 대신 **계정 이메일 문맥**으로 다시 감싸, DB 를 다시 만들어 id 가 바뀌어도 같은 계정이면 복원된다(다른 계정으로는 복원 불가). 어느 쪽이든 이 서버에 해당 키가 남아 있는 동안만 복호화된다.

## 데이터 가져오기

| Method | Endpoint | 설명 |
| --- | --- | --- |
| POST | /import/credentials | 계정 JSON 백업 복원 (multipart `file`, 추가 방식). 암호문을 풀어 이 사용자의 문맥·현재 키로 다시 암호화해 넣는다. 풀리지 않는 행(다른 계정의 백업·서버에 없는 키·손상, 2FA 손상 포함)은 넣지 않고 `errors` 로 돌려준다 |

## 파일 보관함 (Backblaze B2)

| Method | Endpoint | 설명 |
| --- | --- | --- |
| GET | /files?folderId= | 폴더 내용 (브레드크럼·하위폴더·파일·사용량) |
| POST | /files/upload?folderId= | 업로드 (multipart `file`, MIME 화이트리스트 + SHA-256 중복제거) |
| GET | /files/:id/url?disposition= | presigned URL 발급 (5분, inline=미리보기). 응답 파일명은 `filename*=UTF-8''…` + ASCII 대체 이름(NFC) — 프론트의 `a.download` 는 다른 origin 이라 무시됨 |
| PATCH | /files/:id/move | 파일 폴더 이동 |
| DELETE | /files/:id | 파일 삭제 (공유 오브젝트 보호) |
| POST | /files/folders | 폴더 생성 |
| DELETE | /files/folders/:id | 폴더 삭제 (하위 재귀 soft delete) |

## AI

| Method | Endpoint | 설명 |
| --- | --- | --- |
| GET | /ai/reports | 저장된 AI 리포트 목록 조회 |
| POST | /ai/reports | 기간별 가계부 분석 → AI 리포트 생성·저장 |

## 웹 푸시

| Method | Endpoint | 설명 |
| --- | --- | --- |
| GET | /push/public-key | VAPID 공개키 조회 |
| POST | /push/subscribe | 구독 등록 (endpoint·p256dh·auth) |
| POST | /push/unsubscribe | 구독 해제 |
| POST | /push/test | 테스트 푸시 발송 |

> VAPID 키 미설정 시 푸시 발송은 비활성(앱 내 알림은 정상 동작).

## 파일 변환

| Method | Endpoint | 설명 |
| --- | --- | --- |
| POST | /convert/image-to-pdf | 이미지 → PDF 변환 |
| POST | /convert/pdf-to-image | PDF → 이미지 변환 |

## 시스템 로그

| Method | Endpoint | 설명 |
| --- | --- | --- |
| GET | /system-logs?level=&category=&from=&to=&q=&page=&limit= | 크론/투자갱신 등 백그라운드 작업 실행 로그 목록 (레벨·카테고리·기간·메시지 검색 + 페이지네이션) |

> `level`: info / warn / error · `category`: recurring_buy / recurring_tx / cron / asset / file / security / ai
> 조회 전용(읽기 API만 존재) — 기록은 `SystemLogService.info/warn/error`를 각 서비스·크론이 직접 호출해 적재하며 실패해도 호출부 로직에 영향 없음(fire-and-forget). 90일 경과 항목은 소프트삭제 자동정리 크론(매일 03:00)이 함께 정리.
