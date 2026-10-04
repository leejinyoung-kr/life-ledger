# syntax=docker/dockerfile:1
FROM node:26-alpine AS base
RUN corepack enable
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
ENV NEXT_PUBLIC_BACKEND_URL=$NEXT_PUBLIC_BACKEND_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

FROM prepare AS lint
RUN pnpm --filter frontend run lint

FROM prepare AS test
RUN pnpm --filter frontend run test

FROM prepare AS build
RUN --mount=type=cache,id=nextjs-cache-docnexus,target=/app/frontend/.next/cache \
    pnpm --filter frontend run build

FROM base AS runtime
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
# lint/test 스테이지는 build와 독립적이라 BuildKit이 병렬로 실행한다.
# 아래 COPY는 산출물이 필요해서가 아니라 두 스테이지를 빌드 그래프에 강제로 포함시켜(=반드시 통과해야 진행되도록) 넣은 것.
COPY --from=lint /app/frontend/package.json /tmp/.lint-ok
COPY --from=test /app/frontend/package.json /tmp/.test-ok
COPY --from=build /app/frontend/.next/standalone ./
COPY --from=build /app/frontend/.next/static ./frontend/.next/static
COPY --from=build /app/frontend/public ./frontend/public
RUN rm -f /tmp/.lint-ok /tmp/.test-ok

USER node

EXPOSE 3000
CMD ["node", "frontend/server.js"]
