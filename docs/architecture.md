# DocNexus — Architecture

## Overview

개인 문서·자산·계정 통합 관리 플랫폼

## Stack

| Layer | Tech | 상태 |
| --- | --- | --- |
| Frontend | Next.js 16.2 (App Router), React 19, TypeScript, Tailwind CSS v4 | 주요 페이지 구현 완료 |
| Backend | NestJS 11, TypeScript | 19개 모듈 구현 완료 |
| ORM | Prisma | 구현 완료 |
| DB | MariaDB 11 | 20개 테이블 구현 완료 |
| Auth | Google OAuth 2.0 + JWT (전역 가드) | 구현 완료 |
| 암호화 | AES-256-GCM (`CREDENTIAL_SECRET`) | 구현 완료 |
| Storage | Cloudflare R2 | 미구현 |
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
| security | /security | 구현 완료 |
| settings | /settings | 구현 완료 |
| trash | /trash | 구현 완료 |
| category | /categories | 구현 완료 |
| search | /search | 구현 완료 |
| dashboard | /dashboard | 구현 완료 |
| identity | /identities | 구현 완료 |
| credential | /credentials | 구현 완료 |
| env | /env-projects, /env-vars | 구현 완료 |
| export | /export | 구현 완료 |

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
| /files | UI 완료 (백엔드 미구현 — R2) |
| /ai-report | UI 완료 (백엔드 미구현 — Claude API) |
| /assistant | UI 완료 (백엔드 미구현 — Claude API) |
