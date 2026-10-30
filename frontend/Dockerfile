# syntax=docker/dockerfile:1
FROM node:26-alpine AS base
# Node 25 부터 corepack 이 Node 이미지에 들어 있지 않아 따로 설치한다 (버전 고정)
RUN npm install -g corepack@0.36.0 && corepack enable
WORKDIR /app

FROM base AS deps
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY frontend/package.json ./frontend/
COPY backend/package.json ./backend/
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    --mount=type=secret,id=npm_read_token \
    pnpm config set "//npm.pkg.github.com/:_authToken" "$(cat /run/secrets/npm_read_token)" \
    && pnpm install --frozen-lockfile

FROM deps AS prepare
COPY frontend ./frontend
ENV NEXT_TELEMETRY_DISABLED=1
ARG NEXT_PUBLIC_BACKEND_URL
ARG NEXT_PUBLIC_API_URL
# 데모 인스턴스 빌드만 true — 로그인 화면의 '데모로 둘러보기' 와 데모 띠가 빌드에 들어간다
ARG NEXT_PUBLIC_DEMO_MODE=
ENV NEXT_PUBLIC_BACKEND_URL=$NEXT_PUBLIC_BACKEND_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_DEMO_MODE=$NEXT_PUBLIC_DEMO_MODE

# lint · test 는 배포 워크플로의 GitHub 검사 잡(ci.yml)이 먼저 통과시킨다 — 이미지에서는 빌드만 한다 (infra ADR 0009)
FROM prepare AS build
RUN --mount=type=cache,id=nextjs-cache-life-ledger,target=/app/frontend/.next/cache \
    pnpm --filter frontend run build

FROM base AS runtime
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
COPY --from=build /app/frontend/.next/standalone ./
COPY --from=build /app/frontend/.next/static ./frontend/.next/static
COPY --from=build /app/frontend/public ./frontend/public

USER node

EXPOSE 3000
CMD ["node", "frontend/server.js"]
