# DocNexus — Architecture

## Overview

개인 문서·자산·계정 통합 관리 플랫폼

## Stack

| Layer | Tech | 상태 |
| --- | --- | --- |
| Frontend | Next.js (App Router), TypeScript, Tailwind CSS | 로그인 구현 완료 |
| Backend | NestJS, TypeScript | 인증 구현 완료 |
| ORM | Prisma | 구현 완료 |
| DB | MariaDB 11 | 구현 완료 |
| Auth | Google OAuth 2.0 + JWT | 구현 완료 |
| Storage | Cloudflare R2 | 미구현 |
| AI | Claude API (claude-sonnet-4-6) | 미구현 |

## Ports

| Service | Port |
|---------|------|
| Frontend | 3000 |
| Backend | 8000 |
| DB (local) | 3306 |
| DB (docker) | 3308 |
