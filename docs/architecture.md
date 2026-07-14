# DocNexus — Architecture

## Overview

개인 문서·자산·계정 통합 관리 플랫폼

## Stack

| Layer | Tech | 상태 |
| --- | --- | --- |
| Frontend | Next.js 16.2 (App Router), React 19, TypeScript, Tailwind CSS v4 | 구현 완료 |
| 상태관리 | TanStack Query (React Query) — lib/query·queryKeys | 전 페이지 전환 완료 |
| Backend | NestJS 11, TypeScript | 32개 모듈 구현 완료 |
| ORM | Prisma | 구현 완료 |
| DB | MariaDB 11 | 32개 테이블 구현 완료 |
| Auth | Google OAuth 2.0 + JWT (전역 가드 + 새 기기 감지) | 구현 완료 |
| Rate-limit | @nestjs/throttler | 구현 완료 |
| 암호화 | AES-256-GCM(`CREDENTIAL_SECRET`) / 마스터잠금 scrypt | 구현 완료 |
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
| asset | /assets | 구현 완료 |
| note | /notes | 구현 완료 |
| calendar | /calendar | 구현 완료 |
| notification | /notifications | 구현 완료 |
| task | /tasks | 구현 완료 |
| goal | /goals | 구현 완료 |
| security | /security (보안센터 + 마스터잠금 Vault + 유출검사·강도통계) | 구현 완료 |
| access-log | (전역, /security/access-logs로 노출) | 구현 완료 |
| settings | /settings | 구현 완료 |
| trash | /trash | 구현 완료 |
| category | /categories | 구현 완료 |
| search | /search | 구현 완료 |
| dashboard | /dashboard (요약·현금흐름예측·D-day) | 구현 완료 |
| identity | /identities | 구현 완료 |
| credential | /credentials | 구현 완료 |
| env | /env-projects, /env-vars | 구현 완료 |
| file | /files (Backblaze B2) | 구현 완료 |
| export | /export | 구현 완료 |
| import | /import | 구현 완료 |
| maintenance | (크론 — 알림·휴지통·보안점수 스냅샷·순자산 스냅샷·DB 백업·AI 리포트 자동생성·투자 현재가 갱신) | 구현 완료 |
| ai | /ai (AI 리포트, 사용자별 OpenAI 키) | 구현 완료 |
| mail | (SMTP 메일 발송 — 이메일 코드 로그인 등, 미설정 시 no-op) | 구현 완료 |
| push | /push (웹 푸시 구독/발송 — VAPID) | 구현 완료 |
| convert | /convert (이미지↔PDF 변환) | 구현 완료 |
| system-log | /system-logs (백그라운드 작업 실행 로그 — 크론·투자 현재가 갱신 등, 조회 전용) | 구현 완료 |
| health | /health (헬스체크) | 구현 완료 |

## 크론 스케줄러

`@nestjs/schedule` 기반, `backend/src/maintenance/`(AI 리포트는 같은 모듈에 등록된 `ai-report-cron.service.ts`)에 위치. `backend/Dockerfile`에서 컨테이너 타임존을 `TZ=Asia/Seoul`로 고정하여 서버 로컬 시간(KST) 기준으로 실행된다.

| 일정 | 파일 | 내용 |
| --- | --- | --- |
| 매일 03:00 | trash-cron.service.ts | soft-delete 후 30일 경과 항목 영구삭제 (거래·예적금·투자·구독·자산·할일·노트·캘린더·신원·계정·ENV 등) + 시스템 로그 90일 경과분 삭제 |
| 매일 04:00 | db-backup-cron.service.ts | `mariadb-dump` → gzip 압축 후 `backups/`에 저장, 30일 경과 백업 자동 삭제 |
| 매일 09:00 | notification-cron.service.ts | 사용자별 알림 생성(예적금 만기 D-30, 구독결제/체험종료 D-3, 신원만료 D-60, 할일마감 D-1, 비번회전 90일) + 웹푸시 발송. 만기/마감 알림은 설정(`notifMaturity`/`notifDeadline`)으로 개별 토글 가능 |
| 매일 09:00 | security-snapshot-cron.service.ts | 사용자별 보안 점수 일별 스냅샷 적재 |
| 매일 09:00 | recurring-cron.service.ts (`run`) | 반복거래(국내, `transaction.service.ts`의 `materializeRecurring`)는 매일 실행. 반복매수(국내, `investment.service.ts`의 `materializeRecurringBuys`) + 국내 투자 종목 현재가 갱신(`refreshCurrentValues`)은 실제 증권시장이 열리는 평일(KST 기준, `isWeekdayKST()`)에만 실행하고 주말엔 건너뜀. 전체 사용자를 순회하며, 사용자별 실패는 로그만 남기고 계속 진행. 반복거래/반복매수는 서로 독립적으로 처리 건수를 집계해 완료 로그도 따로 남기며, 처리한 항목이 0건이고 실패도 없으면 그 로그는 남기지 않는다. 반복매수는 종목별로 외부 시세조회 API(네이버/야후)를 호출하므로 3종목씩 묶어 묶음 사이 3초 대기(현재가 갱신은 5종목씩 2초 대기) |
| 매일 23:00 | recurring-cron.service.ts (`runForeign`) | 반복매수(해외 — foreign_stock/foreign_etf) 회차 일괄 생성 + 해외 투자 종목 현재가 갱신. 미국 장이 열린 직후 실시간 가격으로 매수하도록 국내 배치와 시간을 분리. 평일(KST 기준)에만 실행하고 주말엔 로그 없이 조용히 건너뜀. 처리한 반복매수가 0건이고 실패도 없으면 완료 로그를 남기지 않는다 |
| 매월 1일 01:00 | net-worth-snapshot-cron.service.ts | 사용자별 전월(YYYY-MM) 순자산(총자산/총부채) 스냅샷 저장. 같은 달 재실행 시 upsert로 덮어씀 |
| 매월 1일 09:00 | ai-report-cron.service.ts | 설정에서 `notifMonthly`를 켠 사용자의 전월(`last_month`) AI 리포트 자동 생성. OpenAI 키 미설정/분석 내역 없음 등은 사용자별로 조용히 스킵 후 다음 달 재시도 |

> 각 크론의 실패/완료는 `SystemLogService`를 통해 `/system-logs`(`/logs` 화면)에도 기록된다.

## 프론트엔드 페이지

| 경로 | 상태 |
| --- | --- |
| /login | 구현 완료 |
| /dashboard | 구현 완료 |
| /transactions | 구현 완료 |
| /networth | 구현 완료 |
| /subscriptions | 구현 완료 |
| /tasks | 구현 완료 |
| /notes | 구현 완료 |
| /calendar | 구현 완료 |
| /notifications | 구현 완료 |
| /security | 구현 완료 |
| /settings | 구현 완료 |
| /trash | 구현 완료 |
| /codes | 구현 완료 |
| /credentials | 구현 완료 (백엔드 연동) |
| /envs | 구현 완료 (백엔드 연동) |
| /id-wallet | 구현 완료 (백엔드 연동) |
| /files | 구현 완료 (Backblaze B2) |
| /ai-report | 구현 완료 (백엔드 연동) |
| /logs | 구현 완료 (백엔드 연동) |

> 모든 페이지·공통 컴포넌트는 React Query(useApiQuery/useApiMutation) 기반. 인증(401 refresh)·마스터잠금(423 unlock)은 lib/api 래퍼가 처리.
