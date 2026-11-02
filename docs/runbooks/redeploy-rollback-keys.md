# 다시 배포 · 이전 커밋으로 되돌리기 · 키 교체 · DB 복원

> 배포 워크플로 · compose · [backend/README.md](../../backend/README.md) · [CLAUDE.md](../../CLAUDE.md) 에 흩어진 절차를 한곳에 묶었다 (2026-11-02, AI 초안).
> 명령은 워크플로에 있는 그대로다. **「운영에서 해 보지 않음」 표시가 붙은 절은 아직 실제로 돌려 본 적이 없다.**

## 언제 사용

- 코드는 그대로인데 서버 `.env` 만 바꿨다 (키 교체 · 설정 변경)
- 배포가 실패했거나, 배포한 버전이 잘못돼 이전 버전으로 돌아가야 한다
- 홈서버 러너가 죽어서 main push 로 배포가 돌지 않는다
- 암호화 키 · JWT 시크릿 · Tailscale 인증 키를 바꿔야 한다
- DB 를 덤프로 되돌려야 한다

## 사전 확인

- 배포는 GitHub 러너의 검사(`ci.yml` — lint · 타입 · build · test)를 통과한 커밋만 홈서버 러너가 그 커밋으로 `reset --hard` 해서 올린다. 실행은 한 번에 하나씩이다(`concurrency`).
- 배포 전 점검(`check-env` · `migrate deploy` · `crypto-check` · `nginx -t`)이 실패하면 `up -d` 까지 가지 않는다 — **기존 컨테이너가 그대로 서비스한다.** 배포 실패가 곧 서비스 중단은 아니다.
- 홈서버 배포는 레포 공통 잠금 `/tmp/deploy.lock` 안에서 돈다. 손으로 돌릴 때도 같은 잠금을 쓴다.
- `.env` · `backend/.env` 값은 화면 · 로그에 출력하지 않는다. 키는 서버 밖(safe-box)에도 둔다.

## 절차

### 1. `.env` 만 바꿨을 때 — 수동 실행

GitHub Actions → `Deploy Home Server` → **Run workflow**(브랜치 `main`). 수동 실행은 바뀐 파일 목록이 비어 backend · frontend 를 둘 다 빌드하고, nginx 도 다시 만든다(사이드카는 다시 만들지 않는다). 운영 뒤에 데모도 다시 뜬다.

- 다른 브랜치에서 실행하면 배포 잡이 돌지 않는다(`if: github.ref == 'refs/heads/main'`).

### 2. 이전 커밋으로 되돌리기 — 보통은 revert 를 배포

1. develop 에서 문제 커밋을 `git revert` → main 에 합쳐 push. 검사 · 배포를 평소대로 거친다.
2. **마이그레이션이 들어 있던 커밋이면 먼저 본다.** Prisma migrate 에는 되돌리기(down)가 없다([ADR 0004](../adr/0004-auto-migrate-on-deploy.md)). 코드만 되돌리면 옛 코드가 새 스키마로 돈다.
   - 컬럼 · 테이블을 **더하기만** 한 마이그레이션 — 보통 옛 코드가 그대로 돈다.
   - **지우거나 바꾼** 마이그레이션 — 되돌리는 마이그레이션을 새로 만들거나, 아래 6 의 DB 복원이 필요하다. 이 경우는 해 본 적이 없다.

### 3. 러너가 죽었을 때 — 홈서버에서 손으로 *(운영에서 해 보지 않음)*

워크플로 「Build and deploy」 의 순서를 그대로 손으로 한다. 패키지 읽기 토큰(`read:packages` classic PAT)이 빌드에 필요하다 — 셸에만 넣고 출력하지 않는다.

```bash
# 홈서버
cd ~/apps/life-ledger
git fetch origin main
git reset --hard <배포할 커밋>          # 검사를 통과한 커밋
export NPM_READ_TOKEN="<read:packages classic PAT>"
export GIT_COMMIT="$(git rev-parse --short=12 HEAD)"
(
  flock -x 200
  docker compose build backend frontend
  docker compose run --rm --no-deps backend node dist/config/check-env.js
  docker compose run --rm backend npx prisma migrate deploy
  docker compose run --rm backend node dist/crypto/crypto-check.js
  docker compose run --rm --no-deps nginx nginx -t
  docker compose up -d
  docker compose up -d --no-deps --force-recreate nginx
) 200>/tmp/deploy.lock
```

- 앞 단계가 실패하면 거기서 멈춘다(그 뒤를 돌리지 않는다).
- 데모도 갱신하려면 [demo-operations.md](demo-operations.md) 「처음부터 다시 만들기」 4 의 순서.
- 러너를 살리는 법(systemd `svc.sh`, sudo 필요)은 infra 레포 README 「홈서버 폴더」 · 런북 `homeserver-reboot-check.md`.

### 4. 보관함 암호화 키 교체 (`CRYPTO_KEYS`)

절차는 [backend/README.md](../../backend/README.md) 「보관함 암호화 키 교체」 그대로다: 새 키를 맨 앞에 추가 → 수동 실행(위 1) → `crypto-check` 결과에서 이전 키 건수 0 확인 → 이전 키를 빼고 다시 수동 실행.

- 이전 키로 된 암호문이 남았는데 키를 빼면 배포 전 점검과 부팅이 멈추고 남은 위치(`table.column#id`)를 알려 준다 — 기존 컨테이너는 계속 돈다.
- 뺀 키는 **30일 동안 서버 밖에 보관**한다. 앱의 매일 DB 백업(30일 보관)에 그 키로 된 암호문이 들어 있다.

### 5. JWT 시크릿 · Tailscale 인증 키

- `JWT_SECRET` · `JWT_REFRESH_SECRET` · `JWT_VAULT_SECRET` — 서로 다른 32자 이상 값([CLAUDE.md](../../CLAUDE.md) 「인증 전제」). 바꾸고 수동 실행(위 1). **refresh 시크릿을 바꾸면 모든 기기가 다시 로그인**해야 하고, vault 시크릿을 바꾸면 보관함이 다시 잠긴다. 데모 `backend/.env.demo` 의 값은 운영과 달라야 한다.
- **Tailscale 인증 키** *(운영에서 해 보지 않음)* — `TS_AUTHKEY` 는 노드가 처음 붙을 때만 쓴다. 그 뒤로는 `tailscale_state` 볼륨(`doc-nexus_tailscale_state`, 데모는 `life-ledger-demo_tailscale_state`)의 노드 정보로 붙는다. 관리 화면에서 노드를 지웠거나 볼륨을 잃었으면 새 `tag:app` 키를 루트 `.env`(데모는 `.env.demo`)의 `TS_AUTHKEY` 에 넣고 `docker compose up -d --no-deps --force-recreate tailscale`. 붙은 뒤에는 키를 지워도 된다.

### 6. DB 복원 *(운영에서 해 보지 않음)*

DB 는 이 레포가 아니라 infra 레포의 공용 MariaDB 다. 절차는 infra 런북을 따른다.

| 출처 | 어디 | 절차 |
| --- | --- | --- |
| 손으로 뜬 덤프 | 홈서버 `~/backups/<날짜>/` | infra `docs/runbooks/db-dump-restore.md` |
| 개발 PC 가 매일 21시 가져온 덤프 (2026-10-25 ~) | 개발 PC `infra/backups/auto/<날짜>/lifeledger.sql.gz` | infra `docs/runbooks/pull-backups.md` 「복원 확인」 · 「홈서버를 잃었을 때」 |
| 앱의 매일 04시 덤프 (30일 보관) | 볼륨 `doc-nexus_db_backups`, `lifeledger_<날짜>.sql.gz` | 위 두 출처가 없을 때 두 번째 출처 (infra `db-dump-restore.md` 「참고」) |

- **2026-10-28 전 덤프는 시각이 UTC 다** — 지금 앱은 KST 벽시계로 쓴다. infra `db-dump-restore.md` 「전환 전 덤프를 복원할 때」.
- 덤프 속 암호문은 그때 키로 되어 있다. 그 키가 `CRYPTO_KEYS` 에 없으면 부팅이 멈춘다 — 위 4 의 "뺀 키 30일 보관" 이 이것 때문이다. 키를 다시 넣고 부팅하면 지금 키로 재암호화된다.
- 복원 전에 backend 를 멈춘다(`docker compose stop backend`). 돌던 backend 가 복원 중에 쓰면 섞인다.

## 검증

- Actions 로그 끝의 `backend health: healthy` · `nginx health: healthy` · 두 번째 `crypto-check` 결과(키별 건수)
- `GET /api/v1/_meta`(로그인 필요) — `commit` 이 배포한 커밋인지, `warn` 배열이 비었는지
- 운영 로그인 · 보관함 열람 한 건 · 데모 로그인

## 안 되면

- **`check-env` 에서 멈춘다** → 새 코드가 요구하는 키가 서버 `.env` 에 없다. 로그에 틀린 키 목록이 나온다(값은 안 나온다). `backend/.env.example` 과 대조한다.
- **`crypto-check` 에서 멈춘다** → 키 설정과 DB 암호문이 안 맞는다. 위 4 · 6.
- **`nginx -t` · `nginx health` 에서 멈춘다** → [nginx-sidecar-down.md](nginx-sidecar-down.md).
- **디스크가 찼다** → 워크플로 「Clean up docker」 와 같은 두 명령(잠금 안에서): `docker builder prune -f --max-used-space 20GB` · `docker image prune -f`. 배경은 [포스트모템](../postmortems/2026-10-16-homeserver-disk-build-cache.md).

## 참고

- [.github/workflows/deploy-home-server.yml](../../.github/workflows/deploy-home-server.yml) · [docker-compose.yml](../../docker-compose.yml)
- [backend/README.md](../../backend/README.md) 「환경 변수」 · 「보관함 암호화 키 교체」
- ADR [0002](../adr/0002-field-encryption-aes-gcm-keyring.md) 암호화 키링 · [0003](../adr/0003-home-server-self-hosted-runner.md) 홈서버 배포 · [0004](../adr/0004-auto-migrate-on-deploy.md) 배포 중 마이그레이션 · [0006](../adr/0006-shared-mariadb-per-app-user.md) 공용 DB
- infra 레포(비공개) — README 「홈서버 폴더」 · 「docker 정리」, 런북 `db-dump-restore.md` · `pull-backups.md` · `homeserver-reboot-check.md`
