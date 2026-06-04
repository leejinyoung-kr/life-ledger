# DocNexus — API 명세

Base URL: `http://localhost:8000/api/v1`

> 상세 문서: Swagger UI → <http://localhost:8000/api-docs>

## 인증

| Method | Endpoint | 설명 |
| --- | --- | --- |
| GET | /auth/google | Google OAuth 로그인 리다이렉트 |
| GET | /auth/google/callback | OAuth 콜백, JWT 발급 후 프론트엔드로 리다이렉트 |

> 이후 모든 API는 `Authorization: Bearer <access_token>` 헤더 필요

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
| PUT | /transactions/:id | 내역 수정 |
| DELETE | /transactions/:id | 내역 삭제 (soft delete) |

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

## 미구현

| 영역 | 설명 |
| --- | --- |
| 자격증명 보관함 | AES-256 암호화 저장 (설계 예정) |
| ENV 파일 보관함 | 암호화 저장 (설계 예정) |
| 파일 보관함 | Cloudflare R2 연동 (설계 예정) |
| 신원 지갑 | 신분증·여권 사본 보관 (설계 예정) |
| AI 리포트 | Claude API 기반 분석 (설계 예정) |
| 어시스턴트 | Claude API 챗봇 (설계 예정) |
