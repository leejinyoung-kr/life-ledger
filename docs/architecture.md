# DocNexus — Architecture

## Overview

개인 문서·자산·계정 통합 관리 플랫폼

## Stack

| Layer | Tech |
|-------|------|
| Frontend | Next.js (App Router), TypeScript, Tailwind CSS |
| Backend | NestJS, TypeScript |
| ORM | Prisma |
| DB | MariaDB 11 |
| Auth | Google OAuth 2.0 + JWT |
| Storage | Cloudflare R2 |
| AI | Claude API (claude-sonnet-4-6) |

## Ports

| Service | Port |
|---------|------|
| Frontend | 3000 |
| Backend | 8000 |
| DB (local) | 3306 |
| DB (docker) | 3308 |
