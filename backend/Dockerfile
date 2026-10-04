# syntax=docker/dockerfile:1
FROM node:26-alpine AS base
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

FROM deps AS prepare
COPY backend ./backend
RUN pnpm --filter backend exec prisma generate

FROM prepare AS test
RUN pnpm --filter backend run test

FROM prepare AS build
RUN pnpm --filter backend run build

FROM base AS runtime
ENV NODE_ENV=production
ENV TZ=Asia/Seoul
# DB 백업 크론(mysqldump)용 + 컨테이너 타임존(KST) 적용용
RUN apk add --no-cache mariadb-client tzdata \
    && cp /usr/share/zoneinfo/$TZ /etc/localtime \
    && echo $TZ > /etc/timezone
# test 스테이지는 build와 독립적이라 BuildKit이 병렬로 실행한다.
# 아래 COPY는 산출물이 필요해서가 아니라 test 스테이지를 빌드 그래프에 강제로 포함시켜(=반드시 통과해야 진행되도록) 넣은 것.
COPY --from=test /app/backend/package.json /tmp/.test-ok
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/backend/node_modules ./backend/node_modules
COPY --from=build /app/backend/package.json ./backend/package.json
COPY --from=build /app/backend/prisma.config.ts ./backend/prisma.config.ts
COPY --from=build /app/backend/dist ./backend/dist
COPY --from=build /app/backend/prisma ./backend/prisma

RUN addgroup -S app && adduser -S app -G app \
    && mkdir -p /app/backend/backups \
    && chown -R app:app /app \
    && rm -f /tmp/.test-ok
USER app

# 빌드된 커밋 — /_meta 가 "지금 도는 것이 어느 코드인지" 보여준다.
# 맨 끝에 두어 커밋이 바뀌어도 앞 레이어 캐시가 깨지지 않게 한다
ARG GIT_COMMIT=
ENV GIT_COMMIT=$GIT_COMMIT

WORKDIR /app/backend
EXPOSE 8000
CMD ["node", "dist/main"]
