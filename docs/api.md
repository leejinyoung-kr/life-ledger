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

> 전역 JWT 가드 적용 — 로그인 관련(`@Public()`) 외 **모든** 엔드포인트는 `Authorization: Bearer <access_token>` 헤더 필수. 누락/만료 시 401.

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
| GET | /security/summary | 보안 요약 |
| GET | /security/risks | 보안 위험 목록 |
| GET | /security/sessions | 로그인 세션 목록 |
| POST | /security/risks/:id/resolve | 위험 항목 해결 처리 |
| POST | /security/sessions/:id/revoke | 세션 단건 차단 |
| POST | /security/sessions/revoke-all | 전체 세션 차단 |

## 설정

| Method | Endpoint | 설명 |
| --- | --- | --- |
| GET | /settings | 사용자 설정 조회 |
| PUT | /settings | 사용자 설정 수정 |

## 휴지통

| Method | Endpoint | 설명 |
| --- | --- | --- |
| GET | /trash | 삭제된 항목 목록 |
| POST | /trash/restore | 선택 항목 복원 |
| POST | /trash/restore-all | 전체 복원 |
| POST | /trash/purge | 선택 항목 영구 삭제 |
| POST | /trash/empty | 휴지통 비우기 |

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
| GET | /dashboard/summary | 요약 — 이번 달 수입/지출·순자산·활성구독 + 카테고리 예산·최근 거래·다가오는 일정 |

## 신원 지갑

| Method | Endpoint | 설명 |
| --- | --- | --- |
| GET | /identities | 신원 문서 목록 (번호는 마스킹) |
| GET | /identities/:id/reveal | 번호 원문 복호화 |
| POST | /identities | 신원 문서 추가 (번호 AES 암호화) |
| PUT | /identities/:id | 수정 (`number` 전달 시 재암호화) |
| DELETE | /identities/:id | 삭제 (soft delete) |

> `type`: passport / idcard / license / cert / etc

## 계정 보관함

| Method | Endpoint | 설명 |
| --- | --- | --- |
| GET | /credentials | 계정 목록 (비번 제외, `has2fa` 만 노출) |
| GET | /credentials/:id/reveal | 비밀번호·TOTP 원문 복호화 |
| GET | /credentials/template | 엑셀 양식(.xlsx) 다운로드 |
| GET | /credentials/export | 계정 엑셀 다운로드 (비밀번호 평문 — 본인 백업) |
| POST | /credentials | 계정 추가 (비번·TOTP AES 암호화) |
| POST | /credentials/import | 엑셀 업로드 → 일괄 추가 (multipart `file`) |
| PUT | /credentials/:id | 수정 (`password`/`totp` 전달 시 재암호화) |
| DELETE | /credentials/:id | 삭제 (soft delete) |

## ENV 보관함

| Method | Endpoint | 설명 |
| --- | --- | --- |
| GET | /env-projects | 프로젝트 목록 (환경별 변수 개수 포함) |
| POST | /env-projects | 프로젝트 추가 |
| PUT | /env-projects/:id | 프로젝트 수정 |
| DELETE | /env-projects/:id | 프로젝트 삭제 (하위 변수 포함 soft delete) |
| GET | /env-projects/:id/vars?env= | 환경별 변수 목록 (값 마스킹) |
| GET | /env-projects/:id/export?env= | 환경 변수 원문 내보내기 (.env 복사/다운로드용) |
| POST | /env-projects/:id/vars | 변수 추가 (선택 환경마다 생성, 값 AES 암호화) |
| POST | /env-projects/:id/bulk | .env 텍스트 일괄 파싱 저장 |
| GET | /env-vars/:id/reveal | 변수 값 원문 복호화 |
| PUT | /env-vars/:id | 변수 수정 (`value` 전달 시 재암호화) |
| DELETE | /env-vars/:id | 변수 삭제 (soft delete) |

> `env`: dev / staging / prod

## 데이터 내보내기

| Method | Endpoint | 설명 |
| --- | --- | --- |
| GET | /export/credentials | 계정 JSON 백업 (비번/TOTP 암호문 보존) |
| GET | /export/backup | 전체 데이터 ZIP (도메인별 JSON + 메모 마크다운) |

> 암호화 컬럼은 암호문(`v1:...`)으로 내보내며, 동일한 `CREDENTIAL_SECRET` 환경에서만 복호화 가능하다.

## 미구현

| 영역 | 설명 |
| --- | --- |
| 파일 보관함 | Cloudflare R2 연동 (외부 연동 예정) |
| AI 리포트 | Claude API 기반 분석 (외부 연동 예정) |
| 어시스턴트 | Claude API 챗봇 (외부 연동 예정) |
