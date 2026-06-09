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
| POST | /auth/refresh | refresh 쿠키로 새 access 발급 (`@Public`) |
| POST | /auth/logout | refresh 쿠키 제거 (`@Public`) |

> 토큰: **Access(15분)** 는 `?token=` 으로 전달 → localStorage → `Authorization: Bearer`.
> **Refresh(7일)** 는 httpOnly 쿠키(`refresh_token`)로만 저장. access 만료(401) 시 프론트가 `/auth/refresh` 1회 호출해 갱신·재요청.
> 전역 JWT 가드 — 로그인 관련(`@Public()`) 외 **모든** 엔드포인트는 access 토큰 필수.

## 가계부 — 수입/지출

| Method | Endpoint | 설명 |
| --- | --- | --- |
| GET | /transactions?from=&to=&type=&category=&q= | 내역 목록 (날짜범위/유형/카테고리/검색 필터) |
| GET | /transactions/summary?month= | 월 요약 (수입/지출/저축이동/실소비/잔액) |
| GET | /transactions/monthly-trend?month= | 월별 지출 추이 (최근 5개월) |
| GET | /transactions/recurring | 반복 거래 목록 (동일 규칙 중복 제거) |
| POST | /transactions | 내역 추가 |
| POST | /transactions/import | 엑셀 양식(.xlsx) 업로드 → 행별 검증 후 일괄 추가 (multipart, 필드명 `file`, 최대 5MB) |
| GET | /transactions/export?from=&to=&type=&category=&q= | 현재 필터 내역을 .xlsx 로 스트리밍 다운로드 |
| PUT | /transactions/:id | 내역 수정 (반복은 `scope` 로 범위 지정) |
| DELETE | /transactions/:id | 내역 삭제 (soft delete) |

> **반복 거래 자동 생성/수정**: 활성 반복 템플릿은 조회 시점에 현재 월까지 회차를 자동 생성(idempotent, `recurring_period` 식별)한다.
> 수정 `scope`: `one`(이번 회차만 — 개별 수정 시 `recurring_overridden` 고정) / `future`(이후 전체) / `all`(전체). 범위 수정은 개별 수정된 회차를 보존(덮어쓰지 않음).

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

## 가계부 — 투자

| Method | Endpoint | 설명 |
| --- | --- | --- |
| GET | /investments | 투자 목록 (수익/수익률 파생값 포함) |
| GET | /investments/summary | 요약 (총 평가금액/원금/수익/수익률) |
| POST | /investments | 투자 추가 |
| PUT | /investments/:id | 투자 수정 |
| DELETE | /investments/:id | 투자 삭제 (soft delete) |

## 구독 관리

| Method | Endpoint | 설명 |
| --- | --- | --- |
| GET | /subscriptions | 구독 목록 |
| GET | /subscriptions/summary | 요약 (월 총액/연 총액/구독 수) |
| GET | /subscriptions/unused | 미사용 구독 목록 |
| POST | /subscriptions | 구독 추가 |
| PUT | /subscriptions/:id | 구독 수정 |
| DELETE | /subscriptions/:id | 구독 삭제 (soft delete) |

## 순자산 (자산)

| Method | Endpoint | 설명 |
| --- | --- | --- |
| GET | /assets | 자산 목록 |
| GET | /assets/summary | 총 자산/부채/순자산 요약 |
| GET | /assets/trend | 순자산 추이 (NetWorthSnapshot) |
| POST | /assets | 자산 추가 |
| PUT | /assets/:id | 자산 수정 |
| DELETE | /assets/:id | 자산 삭제 (soft delete) |

## 메모

| Method | Endpoint | 설명 |
| --- | --- | --- |
| GET | /notes | 메모 목록 |
| POST | /notes | 메모 생성 |
| PUT | /notes/:id | 메모 수정 |
| DELETE | /notes/:id | 메모 삭제 (soft delete) |

## 캘린더

| Method | Endpoint | 설명 |
| --- | --- | --- |
| GET | /calendar | 이벤트 목록 |
| GET | /calendar/upcoming | 다가오는 이벤트 |
| POST | /calendar | 이벤트 생성 |
| PUT | /calendar/:id | 이벤트 수정 |
| DELETE | /calendar/:id | 이벤트 삭제 (soft delete) |

## 알림

| Method | Endpoint | 설명 |
| --- | --- | --- |
| GET | /notifications | 알림 목록 |
| GET | /notifications/unread-count | 미읽음 알림 수 (상단 종 배지) |
| PUT | /notifications/:id/read | 단건 읽음 처리 |
| PUT | /notifications/read-all | 전체 읽음 처리 |
| DELETE | /notifications/bulk | 선택 일괄 삭제 |
| DELETE | /notifications | 전체 삭제 |

> 알림 자동생성 크론(매일 9시): 예적금만기·구독결제/체험·신원만료·할일마감·비번회전(90일). `notif_maturity`·`notif_deadline` 설정으로 게이팅.

## 할 일

| Method | Endpoint | 설명 |
| --- | --- | --- |
| GET | /tasks | 할 일 목록 |
| POST | /tasks | 할 일 추가 |
| PUT | /tasks/:id | 할 일 수정 |
| DELETE | /tasks/:id | 할 일 삭제 (soft delete) |

## 목표

| Method | Endpoint | 설명 |
| --- | --- | --- |
| GET | /goals | 목표 목록 |
| POST | /goals | 목표 추가 |
| PUT | /goals/:id | 목표 수정 |
| DELETE | /goals/:id | 목표 삭제 (soft delete) |

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

## 휴지통

| Method | Endpoint | 설명 |
| --- | --- | --- |
| GET | /trash | 삭제된 항목 목록 (`daysLeft` D-day 포함) |
| POST | /trash/restore | 단건 복원 |
| POST | /trash/bulk-restore | 선택 일괄 복원 |
| POST | /trash/restore-all | 전체 복원 |
| POST | /trash/purge | 단건 영구 삭제 |
| POST | /trash/bulk-purge | 선택 일괄 영구 삭제 |
| POST | /trash/empty | 휴지통 비우기 |

> 30일 경과 자동 영구삭제 크론(매일 3시).

## 카테고리 관리

| Method | Endpoint | 설명 |
| --- | --- | --- |
| GET | /categories?domain= | 카테고리 목록 (도메인 필터 선택) |
| POST | /categories | 카테고리 추가 |
| POST | /categories/seed?domain= | 기본 카테고리 시드 (도메인 미지정 시 전체) |
| PATCH | /categories/:id | 카테고리 수정 |
| DELETE | /categories/:id | 카테고리 삭제 |

## 통합 검색

| Method | Endpoint | 설명 |
| --- | --- | --- |
| GET | /search?q= | 거래·메모·계정·신원·ENV 통합 검색 (타입별 최대 5건, 암호화 컬럼 제외) |

## 대시보드

| Method | Endpoint | 설명 |
| --- | --- | --- |
| GET | /dashboard/summary | 요약 — 이번 달 수입/지출·순자산·활성구독 + 최근 거래·다가오는 일정 |
| GET | /dashboard/cashflow-forecast | 현금흐름 예측 — 활성 구독 + 반복 지출거래 월 환산·합산 |
| GET | /dashboard/deadlines | 통합 D-day — 신원만료·예적금만기·구독결제·할일마감 임박순 |

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
| GET | /env-projects/:id/vars?env= | 환경별 변수 목록 (값 마스킹) |
| GET | /env-projects/:id/diff?base=&target= | 두 환경 비교 (누락·값 불일치) |
| GET | /env-projects/:id/export?env= | 환경 변수 원문 내보내기 (.env 복사/다운로드용) |
| POST | /env-projects/:id/vars | 변수 추가 (선택 환경마다 생성, 값 AES 암호화) |
| POST | /env-projects/:id/bulk | .env 텍스트 일괄 파싱 저장 |
| GET | /env-vars/:id/reveal | 변수 값 원문 복호화 (감사 로그 기록) |
| GET | /env-vars/:id/history | 값 변경 이력 (마스킹) |
| POST | /env-vars/:id/rollback/:historyId | 이력 값으로 롤백 |
| PUT | /env-vars/:id | 변수 수정 (`value` 변경 시 재암호화 + 이전값 이력 적재) |
| DELETE | /env-vars/bulk | 선택 일괄 삭제 |
| DELETE | /env-vars/:id | 변수 삭제 (soft delete) |

> `env`: dev / staging / prod

## 데이터 내보내기

| Method | Endpoint | 설명 |
| --- | --- | --- |
| GET | /export/credentials | 계정 JSON 백업 (비번/TOTP 암호문 보존) |
| GET | /export/backup | 전체 데이터 ZIP (도메인별 JSON + 메모 마크다운) |

> 암호화 컬럼은 암호문(`v1:...`)으로 내보내며, 동일한 `CREDENTIAL_SECRET` 환경에서만 복호화 가능하다.

## 데이터 가져오기

| Method | Endpoint | 설명 |
| --- | --- | --- |
| POST | /import/credentials | 계정 JSON 백업 복원 (multipart `file`, 암호문 v1 형식 검증·보존, 추가 방식) |

## 파일 보관함 (Backblaze B2)

| Method | Endpoint | 설명 |
| --- | --- | --- |
| GET | /files?folderId= | 폴더 내용 (브레드크럼·하위폴더·파일·사용량) |
| POST | /files/upload?folderId= | 업로드 (multipart `file`, MIME 화이트리스트 + SHA-256 중복제거) |
| GET | /files/:id/url?disposition= | presigned URL 발급 (5분, inline=미리보기) |
| PATCH | /files/:id/move | 파일 폴더 이동 |
| DELETE | /files/:id | 파일 삭제 (공유 오브젝트 보호) |
| POST | /files/folders | 폴더 생성 |
| DELETE | /files/folders/:id | 폴더 삭제 (하위 재귀 soft delete) |

## AI

| Method | Endpoint | 설명 |
| --- | --- | --- |
| POST | /ai/parse-transaction | 자연어 → 가계부 거래 초안 파싱 (사용자별 OpenAI 키 사용) |
| GET | /ai/reports | 저장된 AI 리포트 목록 조회 |
| POST | /ai/reports | 기간별 가계부 분석 → AI 리포트 생성·저장 |

## 미구현

| 영역 | 설명 |
| --- | --- |
| 시세 자동연동 | 업비트(crypto만 무료)·주식 외부 API (보류) |
