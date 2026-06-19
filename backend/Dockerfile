FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/
COPY packages/shared/package.json ./packages/shared/
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY packages ./packages
COPY backend ./backend
RUN pnpm --filter backend exec prisma generate
RUN pnpm --filter backend run build

FROM base AS runtime
ENV NODE_ENV=production
# DB 백업 크론(mysqldump)용
RUN apk add --no-cache mariadb-client
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/backend/node_modules ./backend/node_modules
COPY --from=build /app/backend/package.json ./backend/package.json
COPY --from=build /app/backend/dist ./backend/dist
COPY --from=build /app/backend/prisma ./backend/prisma

RUN addgroup -S app && adduser -S app -G app \
    && mkdir -p /app/backend/backups \
    && chown -R app:app /app
USER app

WORKDIR /app/backend
EXPOSE 8000
CMD ["node", "dist/main"]
