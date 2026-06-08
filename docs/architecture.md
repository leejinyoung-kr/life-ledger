# DocNexus — Architecture

## Overview

개인 문서·자산·계정 통합 관리 플랫폼

## Stack

| Layer | Tech | 상태 |
| --- | --- | --- |
| Frontend | Next.js 16.2 (App Router), React 19, TypeScript, Tailwind CSS v4 | 구현 완료 |
| 상태관리 | TanStack Query (React Query) — lib/query·queryKeys | 전 페이지 전환 완료 |
| Backend | NestJS 11, TypeScript | 27개 모듈 구현 완료 |
| ORM | Prisma | 구현 완료 |
| DB | MariaDB 11 | 26개 테이블 구현 완료 |
| Auth | Google OAuth 2.0 + JWT (전역 가드 + 새 기기 감지) | 구현 완료 |
| Rate-limit | @nestjs/throttler | 구현 완료 |
| 암호화 | AES-256-GCM(`CREDENTIAL_SECRET`) / 마스터잠금 scrypt | 구현 완료 |
| Storage | Backblaze B2 (@aws-sdk/client-s3, presigned) | 구현 완료 |
| OCR / 유출검사 | tesseract.js(클라) / HIBP(k-anonymity) | 구현 완료 |
| AI | Claude API (claude-sonnet-4-6) | 미구현 |

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
| maintenance | (크론 — 알림·휴지통·보안점수 스냅샷) | 구현 완료 |

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
| /ai-report | UI 완료 (백엔드 미구현 — Claude API) |
| /assistant | UI 완료 (백엔드 미구현 — Claude API) |

> 모든 페이지·공통 컴포넌트는 React Query(useApiQuery/useApiMutation) 기반. 인증(401 refresh)·마스터잠금(423 unlock)은 lib/api 래퍼가 처리.
