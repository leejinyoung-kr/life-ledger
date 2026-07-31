# syntax=docker/dockerfile:1
FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    --mount=type=secret,id=npm_read_token \
    pnpm config set "//npm.pkg.github.com/:_authToken" "$(cat /run/secrets/npm_read_token)" \
    && pnpm install --frozen-lockfile

FROM deps AS build
COPY backend ./backend
RUN pnpm --filter backend exec prisma generate
RUN pnpm --filter backend run build

FROM base AS runtime
ENV NODE_ENV=production
ENV TZ=Asia/Seoul
# DB 백업 크론(mysqldump)용 + 컨테이너 타임존(KST) 적용용
RUN apk add --no-cache mariadb-client tzdata \
    && cp /usr/share/zoneinfo/$TZ /etc/localtime \
    && echo $TZ > /etc/timezone
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/backend/node_modules ./backend/node_modules
COPY --from=build /app/backend/package.json ./backend/package.json
COPY --from=build /app/backend/prisma.config.ts ./backend/prisma.config.ts
COPY --from=build /app/backend/dist ./backend/dist
COPY --from=build /app/backend/prisma ./backend/prisma

RUN addgroup -S app && adduser -S app -G app \
    && mkdir -p /app/backend/backups \
    && chown -R app:app /app
USER app

WORKDIR /app/backend
EXPOSE 8000
CMD ["node", "dist/main"]
