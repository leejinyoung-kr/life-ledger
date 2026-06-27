# DocNexus — Architecture

## Overview

개인 문서·자산·계정 통합 관리 플랫폼

## Stack

| Layer | Tech | 상태 |
| --- | --- | --- |
| Frontend | Next.js 16.2 (App Router), React 19, TypeScript, Tailwind CSS v4 | 구현 완료 |
| 상태관리 | TanStack Query (React Query) — lib/query·queryKeys | 전 페이지 전환 완료 |
| Backend | NestJS 11, TypeScript | 28개 모듈 구현 완료 |
| ORM | Prisma | 구현 완료 |
| DB | MariaDB 11 | 29개 테이블 구현 완료 |
| Auth | Google OAuth 2.0 + JWT (전역 가드 + 새 기기 감지) | 구현 완료 |
| Rate-limit | @nestjs/throttler | 구현 완료 |
| 암호화 | AES-256-GCM(`CREDENTIAL_SECRET`) / 마스터잠금 scrypt | 구현 완료 |
| Storage | Backblaze B2 (@aws-sdk/client-s3, presigned) | 구현 완료 |
| OCR / 유출검사 | tesseract.js(클라) / HIBP(k-anonymity) | 구현 완료 |
| AI | OpenAI API (사용자별 키·모델, AI 리포트·자연어 거래 파싱) | 구현 완료 |

## Ports

| Service | Port |
|---------|------|
| Frontend | 3000 |
| Backend | 8000 |
| DB (docker) | 3308 |
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
| budget | /budget | 구현 완료 |
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
| maintenance | (크론 — 알림·휴지통·보안점수 스냅샷·DB 백업·AI 리포트 자동생성) | 구현 완료 |
| ai | /ai (자연어 거래 파싱·AI 리포트, 사용자별 OpenAI 키) | 구현 완료 |

## 크론 스케줄러

`@nestjs/schedule` 기반, `backend/src/maintenance/`(AI 리포트는 같은 모듈에 등록된 `ai-report-cron.service.ts`)에 위치. 타임존 지정 없이 서버 로컬 시간(KST) 기준.

| 일정 | 파일 | 내용 |
| --- | --- | --- |
| 매일 03:00 | trash-cron.service.ts | soft-delete 후 30일 경과 항목 영구삭제 (거래·예적금·투자·구독·자산·할일·노트·캘린더·신원·계정·ENV 등) |
| 매일 04:00 | db-backup-cron.service.ts | `mariadb-dump` → gzip 압축 후 `backups/`에 저장, 30일 경과 백업 자동 삭제 |
| 매일 09:00 | notification-cron.service.ts | 사용자별 알림 생성(예적금 만기 D-30, 구독결제/체험종료 D-3, 신원만료 D-60, 할일마감 D-1, 비번회전 90일) + 웹푸시 발송. 만기/마감 알림은 설정(`notifMaturity`/`notifDeadline`)으로 개별 토글 가능 |
| 매일 09:00 | security-snapshot-cron.service.ts | 사용자별 보안 점수 일별 스냅샷 적재 |
| 매월 1일 09:00 | ai-report-cron.service.ts | 설정에서 `notifMonthly`를 켠 사용자의 전월(`last_month`) AI 리포트 자동 생성. OpenAI 키 미설정/분석 내역 없음 등은 사용자별로 조용히 스킵 후 다음 달 재시도 |

> 크론 없이 요청 시점에 즉석 처리되는 것들(참고용 — 위 표와 다른 패턴): 반복 거래/반복매수 자동 생성(`transaction.service.ts`/`investment.service.ts`의 `materializeRecurring*`)은 목록 조회 때마다 호출되어 누적분을 채운다.

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

> 모든 페이지·공통 컴포넌트는 React Query(useApiQuery/useApiMutation) 기반. 인증(401 refresh)·마스터잠금(423 unlock)은 lib/api 래퍼가 처리.
