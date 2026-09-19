# DocNexus — Architecture

## Overview

개인 문서·자산·계정 통합 관리 플랫폼

## Stack

| Layer | Tech | 상태 |
| --- | --- | --- |
| Frontend | Next.js 16.2 (App Router), React 19, TypeScript, Tailwind CSS v4 | 구현 완료 |
| 상태관리 | TanStack Query (React Query) — lib/query·queryKeys | 전 페이지 전환 완료 |
| Backend | NestJS 11, TypeScript | 31개 모듈 구현 완료 |
| ORM | Prisma | 구현 완료 |
| DB | MariaDB 11 | 31개 테이블 구현 완료 |
| Auth | Google OAuth 2.0 + JWT (전역 가드 + 새 기기 감지) | 구현 완료 |
| Rate-limit | @nestjs/throttler | 구현 완료 |
| 암호화 | AES-256-GCM(`CRYPTO_KEYS` 키링 + 필드·사용자 AAD, 부팅 시 자동 재암호화) / 마스터잠금 scrypt | 구현 완료 |
| Storage | Backblaze B2 (@aws-sdk/client-s3, presigned) | 구현 완료 |
| 유출검사 | HIBP(k-anonymity) | 구현 완료 |
| AI | OpenAI API (사용자별 키·모델, AI 리포트) | 구현 완료 |

## Ports

| Service | Port |
|---------|------|
| Frontend | 3000 |
| Backend | 8000 |
| DB (docker) | 3307 |
| Prisma Studio | 5555 |

## 백엔드 모듈

| 모듈 | 경로 prefix | 상태 |
| --- | --- | --- |
| auth | /auth | 구현 완료 |
| transaction | /transactions | 구현 완료 |
| saving | /savings | 구현 완료 |
| investment-account | /investment-accounts | 구현 완료 |
| investment | /investments | 구현 완료 |
| subscription | /subscriptions | 구현 완료 |
| asset | /assets (순자산 요약/추이 — 현금+예적금+투자 집계, 전용 테이블 없음) | 구현 완료 |
| calendar | /calendar (실제 일정 + 구독결제·예적금만기·신원만료 가상 이벤트) | 구현 완료 |
| notification | /notifications | 구현 완료 |
| security | /security (보안센터 + 마스터잠금 Vault + 유출검사·강도통계) | 구현 완료 |
| access-log | (전역, /security/access-logs로 노출) | 구현 완료 |
| settings | /settings | 구현 완료 |
| category | /categories | 구현 완료 |
| search | /search | 구현 완료 |
| dashboard | /dashboard (요약·현금흐름예측·D-day) | 구현 완료 |
| identity | /identities | 구현 완료 |
| credential | /credentials | 구현 완료 |
| env | /env-projects, /env-vars | 구현 완료 |
| file | /files (Backblaze B2) | 구현 완료 |
| export | /export | 구현 완료 |
| import | /import | 구현 완료 |
| maintenance | (크론 — 알림·보안점수 스냅샷·순자산 스냅샷·DB 백업·AI 리포트 자동생성·투자 현재가 갱신·소프트삭제 항목 자동정리) | 구현 완료 |
| ai | /ai (AI 리포트, 사용자별 OpenAI 키) | 구현 완료 |
| mail | (SMTP 메일 발송 — 이메일 코드 로그인 등, 미설정 시 no-op) | 구현 완료 |
| push | /push (웹 푸시 구독/발송 — VAPID) | 구현 완료 |
| convert | /convert (이미지↔PDF 변환) | 구현 완료 |
| system-log | /system-logs (백그라운드 작업 실행 로그 — 크론·투자 현재가 갱신 등, 조회 전용) | 구현 완료 |
| health | /health (헬스체크) | 구현 완료 |

## 크론 스케줄러

`@leejinyoun/core-jobs` 기반(2026-09-20 `@nestjs/schedule` 에서 전환), `backend/src/maintenance/`(AI 리포트는 같은 모듈에 등록된 `ai-report-cron.service.ts`)에 위치. 각 작업은 `@Job({ name, cron, leaseMs })` 으로 등록하고, `AppModule` 의 `JobsModule.forRoot({ timeZone: 'Asia/Seoul' })` 가 KST 기준으로 실행한다(컨테이너도 `TZ=Asia/Seoul`). 부팅 로그에 작업 목록과 다음 실행 시각이 찍힌다.

공통 동작(작업 코드에 try/catch·요약 로그를 따로 쓰지 않는다):

- **실행 기록**: 실행마다 `job_run` 1행 — 시작·종료·상태·요약(작업이 돌려준 문자열)·원본 에러. 실패하면 시스템 로그에도 `예약 작업 실패: <작업>`
- **겹침 방지**: 같은 작업이 이미 돌고 있으면 건너뛴다(`running_key` 유니크)
- **lease**: 작업별 제한 시간 안에 끝나지 않으면 `failed(lease_expired)` 로 마감하고 다음 실행을 막지 않는다. 배포·장애로 프로세스가 죽어 `running` 으로 남은 행도 lease 가 지나면 같은 식으로 마감된다
- 사용자별로 도는 작업은 일부 사용자가 실패해도 나머지를 다 처리한 뒤 실행을 실패로 마감한다(`job-result.ts` 의 `finishPerUser` — 사용자별 원인은 시스템 로그). AI 리포트만 예외(키 미설정 등 예상된 건너뜀이 많아 요약에 건수로만)

| 일정 | 작업 이름 · lease | 파일 | 내용 |
| --- | --- | --- | --- |
| 매일 03:00 | `trash-purge` · 10분 | trash-cron.service.ts | soft-delete 후 30일 경과 항목 영구삭제 (거래·예적금·투자·구독·캘린더·신원·계정·ENV 등) + 시스템 로그·작업 실행 기록 90일 경과분 삭제. 휴지통 UI는 없으며 삭제된 항목은 이 크론으로만 정리됨. 테이블 하나가 실패해도 나머지는 계속 지우고 끝에 실패로 마감 |
| 매일 04:00 | `db-backup` · 30분 | db-backup-cron.service.ts | `mariadb-dump` → gzip 압축 후 `backups/`에 저장, 30일 경과 백업 자동 삭제. 실패하면 쓰다 만 파일을 지운다. lease 가 끝나면 `mariadb-dump` 도 함께 종료(signal) |
| 매일 09:00 | `notification-daily` · 10분 | notification-cron.service.ts | 사용자별 알림 생성(예적금·투자계좌 만기 D-30/14/7/1, 구독결제/체험종료 D-7/3/1, 신원만료 D-60/30/14/7/1, 비번회전 90일 경과 후 30일 간격 재알림) + 웹푸시 발송. 매일 반복 알림을 막기 위해 해당 일자에 정확히 일치할 때만 생성. 만기/마감 알림은 설정(`notifMaturity`/`notifDeadline`)으로 개별 토글 가능 |
| 매일 09:00 | `security-snapshot` · 10분 | security-snapshot-cron.service.ts | 사용자별 보안 점수 일별 스냅샷 적재 |
| 매일 09:00 | `recurring-domestic` · 30분 | recurring-cron.service.ts (`run`) | 반복거래(국내, `transaction.service.ts`의 `materializeRecurring`)는 매일 실행. 반복매수(국내, `investment.service.ts`의 `materializeRecurringBuys`) + 국내 투자 종목 현재가 갱신(`refreshCurrentValues`)은 실제 증권시장이 열리는 평일(KST 기준, `isWeekdayKST()`)에만 실행하고 주말엔 건너뜀. 전체 사용자를 순회하며, 사용자별 실패는 시스템 로그에 남기고 계속 진행한 뒤 실행은 실패로 마감. 반복거래/반복매수는 서로 독립적으로 처리 건수를 집계해 완료 로그도 따로 남기며, 처리한 항목이 0건이고 실패도 없으면 그 로그는 남기지 않는다. 반복매수는 종목별로 외부 시세조회 API(네이버/야후)를 호출하므로 3종목씩 묶어 묶음 사이 3초 대기(현재가 갱신은 5종목씩 2초 대기) |
| 매일 23:00 | `recurring-foreign` · 30분 | recurring-cron.service.ts (`runForeign`) | 반복매수(해외 — foreign_stock/foreign_etf) 회차 일괄 생성 + 해외 투자 종목 현재가 갱신. 미국 장이 열린 직후 실시간 가격으로 매수하도록 국내 배치와 시간을 분리. 평일(KST 기준)에만 실행하고 주말엔 건너뜀(실행 기록 요약에만 `주말 — 건너뜀`). 처리한 반복매수가 0건이고 실패도 없으면 완료 로그를 남기지 않는다 |
| 매주 월요일 01:00 | `net-worth-snapshot` · 10분 | net-worth-snapshot-cron.service.ts | 사용자별 전월(YYYY-MM) 총자산(현금+예적금+투자)·현금 총액(`cash_total`) 스냅샷 저장(`total_debt`는 부동산/부채 기능 제거 이후 항상 0으로 기록, 과거 스냅샷 기록값은 유지). `cash_total`은 자산 요약 API(`/assets/summary`)가 전체 거래를 매번 재집계하지 않고 스냅샷값 + 이후 거래 델타로 계산하는 기준점. 실행 때마다 직전 달을 통째로 재계산해 upsert로 덮어쓰므로, 마감된 달의 거래를 뒤늦게 수정해도 최대 일주일 안에 자동 반영됨 |
| 매월 1일 09:00 | `ai-monthly-report` · 30분 | ai-report-cron.service.ts | 설정에서 `notifMonthly`를 켠 사용자의 전월(`last_month`) AI 리포트 자동 생성. OpenAI 키 미설정/분석 내역 없음 등은 사용자별로 조용히 스킵 후 다음 달 재시도 |

> 작업별 실행 기록은 `job_run` 테이블(시작·종료·상태·요약·원본 에러)에, 사용자에게 보여줄 완료·실패는 `SystemLogService`를 통해 `/system-logs`(`/logs` 화면)에도 기록된다. 실행 기록이 실패로 마감되면 `/logs` 에 `예약 작업 실패: <작업>` 이 남는다.

## 프론트엔드 페이지

| 경로 | 상태 |
| --- | --- |
| /login | 구현 완료 |
| /dashboard | 구현 완료 |
| /transactions | 구현 완료 |
| /networth | 구현 완료 |
| /subscriptions | 구현 완료 |
| /calendar | 구현 완료 |
| /notifications | 구현 완료 |
| /security | 구현 완료 |
| /settings | 구현 완료 |
| /codes | 구현 완료 |
| /credentials | 구현 완료 (백엔드 연동) |
| /envs | 구현 완료 (백엔드 연동) |
| /id-wallet | 구현 완료 (백엔드 연동) |
| /files | 구현 완료 (Backblaze B2) |
| /ai-report | 구현 완료 (백엔드 연동) |
| /logs | 구현 완료 (백엔드 연동) |

> 모든 페이지·공통 컴포넌트는 React Query(useApiQuery/useApiMutation) 기반. 인증(401 refresh)·마스터잠금(423 unlock)은 lib/api 래퍼가 처리.
