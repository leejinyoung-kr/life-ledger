# 데모 인스턴스 운영

> 끝난 공개 준비 계획 [「5단계 운영 절차」](../archive/2026-10-13-public-release-plan.md) 를 옮기고, 그 뒤 바뀐 것(2026-11-02 Nginx · `TRUST_PROXY`)을 반영했다 (2026-11-02, AI 초안).
> 결정 배경은 [ADR 0008](../adr/0008-separate-demo-instance.md). 데모 운영 시작은 2026-10-15.

## 언제 사용

- 데모 주소 `https://lifeledger-demo.tailba78c1.ts.net` 가 이상하다 (데이터가 초기화되지 않았다 · 열리지 않는다)
- 데모 데이터를 지금 바로 초기화하고 싶다
- 데모를 처음부터 다시 만들거나, 데모 env 를 바꿔야 한다

## 사전 확인

- 데모는 운영과 **같은 클론** `~/apps/life-ledger` 에서 compose 파일 하나를 더 얹어 띄운다. 프로젝트 이름 · env 파일 · DB(`lifeledger_demo`) · 포트(3010 · 8010) · Tailscale 노드(`lifeledger-demo`) · 볼륨이 전부 운영과 다르다 ([docker-compose.demo.yml](../../docker-compose.demo.yml)).
- 2026-11-02 부터 데모도 운영과 같은 `nginx/default.conf` 로 사이드카 → nginx → frontend · backend 다. 데모 nginx 컨테이너는 데모 프로젝트 안에 따로 있다.
- 평소에는 손댈 것이 없다 — **main push 때 배포 워크플로 「Deploy demo」 가 운영 배포 뒤에 데모도 다시 띄운다** (홈서버에 `.env.demo` · `backend/.env.demo` 가 있을 때만).
- env 파일 값은 화면 · 로그에 출력하지 않는다.

아래에서 `DEMO` 는 이 명령의 줄임이다.

```bash
docker compose -p life-ledger-demo --env-file .env.demo -f docker-compose.yml -f docker-compose.demo.yml
```

## 절차

### 1. 매일 초기화 (홈서버 사용자 crontab — 이미 걸려 있다)

KST 04:00 에 데이터를 비우고 샘플 데이터 + 마스터 잠금(`demo1234`)을 다시 넣는다. 홈서버 시계가 UTC 라 UTC 19:00 이다. sudo 는 필요 없다.

```cron
0 19 * * * cd ~/apps/life-ledger && docker compose -p life-ledger-demo --env-file .env.demo -f docker-compose.yml -f docker-compose.demo.yml exec -T backend npx tsx prisma/demo-reset.ts 2>&1 | logger -t life-ledger-demo
```

- 확인: `journalctl -t life-ledger-demo --since today` — 마지막 줄이 `데모 초기화 완료` (2026-11-01 19:00 UTC 실행 기록 확인, 2026-11-02).
- `demo-reset.ts` 는 `DEMO_MODE=true` 가 아니면 아무것도 지우지 않고 끝난다 — 운영 컨테이너에 잘못 돌려도 안전하다. `_prisma_migrations` · `holiday` · `job_run` 은 비우지 않는다.

### 2. 지금 바로 초기화

```bash
cd ~/apps/life-ledger
DEMO exec -T backend npx tsx prisma/demo-reset.ts
```

### 3. env 파일 (git · docker 빌드 제외 — `.gitignore` · `.dockerignore` 에 `.env.demo`)

- 루트 `.env.demo`: `DB_PASSWORD`(데모 DB 사용자) · `NEXT_PUBLIC_BACKEND_URL=https://lifeledger-demo.tailba78c1.ts.net` · `NEXT_PUBLIC_API_URL`(같은 주소 + `/api/v1`) · `NEXT_PUBLIC_DEMO_MODE=true` · `TS_AUTHKEY`(tag:app 키, 처음 붙을 때만) · `COMPOSE_PROFILES=homeserver`(nginx · 사이드카를 켠다)
- `backend/.env.demo`: 운영 `backend/.env` 를 복사한 뒤 바꾼다.
  - `JWT_*` 세 개와 `CRYPTO_KEYS` 는 **새로 만든 값** — 운영 키를 데모에 두지 않는다. `CREDENTIAL_SECRET` 비움
  - `FRONTEND_URL` · `CORS_ORIGINS` · `GOOGLE_CALLBACK_URL` 을 데모 주소로. `GOOGLE_*` 는 아무 값(데모 화면에 Google 버튼이 없다)
  - `ALLOWED_EMAILS=nobody@life-ledger.local` (이메일 로그인 막기)
  - B2 는 데모 전용 버킷 · 그 버킷만 쓰는 키. `SMTP_*` · `VAPID_*` 비움
  - `DEMO_MODE=true`, `STORAGE_QUOTA_MB=50`
  - `TRUST_PROXY=1` — 운영과 같다. backend 바로 앞 nginx 가 손님 IP 한 값으로 보낸다 (2026-11-02 넣음, [구현 노트](../implementation-notes.md) 「횟수 제한…」)
- env 만 바꿨으면 Actions 에서 `Deploy Home Server` 를 수동 실행(`workflow_dispatch`)한다 — 운영 · 데모 둘 다 같은 점검을 거쳐 다시 뜬다.

### 4. 처음부터 다시 만들기 *(2026-10-15 처음 띄울 때의 순서 — 다시 해 보지 않음)*

1. **DB** (HeidiSQL root 세션, 홈서버 23306) — infra README 와 같은 형식. infra `initdb/01-app-databases.sh` 에도 같은 줄이 있다.

   ```sql
   CREATE DATABASE IF NOT EXISTS `lifeledger_demo` CHARACTER SET utf8mb4;
   CREATE USER IF NOT EXISTS 'lifeledger_demo'@'%' IDENTIFIED BY '<비밀번호>';
   GRANT ALL PRIVILEGES ON `lifeledger_demo`.* TO 'lifeledger_demo'@'%';
   ```

2. **B2** — 데모 전용 버킷 + 그 버킷만 쓰는 애플리케이션 키. 초기화는 DB 행만 지우고 B2 파일은 남기므로, 버킷 수명 주기 규칙으로 정리한다(`daysFromUploadingToHiding: 1` · `daysFromHidingToDeleting: 1`).
3. **env 파일** — 위 3.
4. **띄우기** — 2026-10-15 에는 손으로 하지 않고 main push 의 「Deploy demo」 단계로 했다(패키지 읽기 토큰 `NPM_READ_TOKEN` 이 워크플로 secret 에만 있다). 워크플로가 하는 순서는 `DEMO build backend frontend` → `DEMO run --rm --no-deps backend node dist/config/check-env.js` → `DEMO run --rm backend npx prisma migrate deploy` → `DEMO up -d`. 그 뒤 샘플 데이터는 위 2 로 넣는다.
5. **확인** — 아래 「검증」.

## 검증

- `https://lifeledger-demo.tailba78c1.ts.net` — '데모로 둘러보기' 버튼 · 맨 위 데모 띠 · 잠금 풀기(`demo1234`) · 계정 삭제 403
- Tailscale 관리 화면에서 노드 `lifeledger-demo` 의 Funnel 이 켜져 있다
- 운영 `https://lifeledger.tailba78c1.ts.net` 로그인 화면에는 데모 버튼이 **없다**
- `DEMO ps` — backend · frontend · nginx healthy, tailscale Up

## 안 되면

- **초기화가 안 됐다** → `journalctl -t life-ledger-demo --since "-2 days"` 로 오류를 본다. 2026-10-15 처음엔 실행 이미지에 `src` 가 없어 시드가 `MODULE_NOT_FOUND` 였다 — 실행 이미지에 `backend/src` 를 넣어 고쳤다.
- **데모 주소가 안 열린다** → [nginx-sidecar-down.md](nginx-sidecar-down.md) 를 `DEMO` 로 따라간다.
- **배포에서 데모만 실패했다** → 운영 배포가 끝난 뒤라 운영은 이미 새 버전이다. 데모 단계 로그(`check-env` · `migrate deploy`)를 본다.
- **데모를 잠시 끄고 싶다** *(운영에서 해 보지 않음)* → `DEMO stop`. 배포 때 다시 뜨지 않게 하려면 홈서버의 `.env.demo` 를 다른 이름으로 옮긴다 — 워크플로가 "데모 env 없음 — 건너뜀" 으로 넘어간다.

## 참고

- [ADR 0008](../adr/0008-separate-demo-instance.md) — 데모를 운영과 따로 · [ADR 0010](../adr/0010-nginx-behind-tailscale-sidecar.md) — 데모도 Nginx 뒤
- [docker-compose.demo.yml](../../docker-compose.demo.yml) · `backend/prisma/demo-reset.ts` · [backend/src/common/demo.ts](../../backend/src/common/demo.ts)
- [.github/workflows/deploy-home-server.yml](../../.github/workflows/deploy-home-server.yml) 「Deploy demo」
- [공개 준비 계획](../archive/2026-10-13-public-release-plan.md) 「5단계」 — 처음 만든 기록
