# DocNexus — Architecture

## Overview

개인 문서·자산·계정 통합 관리 플랫폼

## Stack

| Layer | Tech | 상태 |
| --- | --- | --- |
| Frontend | Next.js (App Router), TypeScript, Tailwind CSS | 초기 구조 |
| Backend | NestJS, TypeScript | 초기 구조 |
| ORM | Prisma | 미구현 |
| DB | MariaDB 11 | 미구현 |
| Auth | Google OAuth 2.0 + JWT | 미구현 |
| Storage | Cloudflare R2 | 미구현 |
| AI | Claude API (claude-sonnet-4-6) | 미구현 |

## Ports

| Service | Port |
|---------|------|
| Frontend | 3000 |
| Backend | 8000 |
| DB (local) | 3306 |
| DB (docker) | 3308 |
