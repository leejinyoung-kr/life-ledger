# 접속이 안 될 때 — 사이드카 · Nginx 가르기

> 이 런북은 [ADR 0010](../adr/0010-nginx-behind-tailscale-sidecar.md) · `docker-compose.yml` · `nginx/default.conf` · 배포 워크플로에 있는 것을 "증상 → 확인 → 조치"로 묶은 것이다 (2026-11-02, AI 초안).
> 명령은 모두 워크플로 · compose 에 있는 그대로다. **운영에서 실제로 장애를 겪고 쓴 문서가 아니다** — 조치는 운영에서 해 보지 않은 것이 많다 (각 줄에 표시).

## 언제 사용

- 운영(`https://lifeledger.tailba78c1.ts.net`) · 데모(`https://lifeledger-demo.tailba78c1.ts.net`) 주소가 열리지 않는다
- 화면에 "요청 실패 (502)" · "(504)" 가 뜬다
- 배포가 `nginx -t` 또는 `nginx health` 에서 실패했다
- 예상하지 못한 413 · 429 가 난다

## 사전 확인

- **입구가 둘이다.** 손님 → Tailscale 사이드카(`tailscale`, 주소 · 인증서 · Funnel) → Nginx(`nginx`, 경로 나누기 · 업로드 한도 · 로그인 횟수 제한) → `frontend` · `backend`. 어느 칸에서 끊겼는지부터 가른다.
- 데모는 같은 설정 파일로 따로 뜬 컨테이너다. 아래 `docker compose` 를 데모에 쓸 때는 `docker compose -p life-ledger-demo --env-file .env.demo -f docker-compose.yml -f docker-compose.demo.yml` 로 바꾼다 ([demo-operations.md](demo-operations.md) 의 `DEMO`).
- 홈서버 `.env` 값은 화면 · 로그에 출력하지 않는다.
- 명령은 홈서버 `~/apps/life-ledger` 에서 돈다.

## 확인 — 원인 가르기

| 증상 | 뜻 | 볼 것 |
| --- | --- | --- |
| 주소가 아예 안 열린다 · 인증서 오류 · DNS 실패 | 사이드카가 받지 못한다 (Nginx 까지 오지 않았다) | `docker compose ps tailscale` · `docker compose logs --tail 50 tailscale`. tailscale 은 nginx 가 healthy 여야 뜬다(`depends_on`) — nginx 가 unhealthy 면 사이드카도 안 뜬다 |
| 응답 헤더 `Server: nginx` + 502 HTML | Nginx 는 받았지만 `backend` · `frontend` 에 닿지 못했다 | `docker compose ps backend frontend` · `docker compose logs --tail 80 backend` |
| 504 | 백엔드가 300초(`proxy_read_timeout`) 안에 답하지 않았다 | 백엔드 로그. 큰 ZIP 내보내기라면 크기부터 |
| 413 JSON `파일이 너무 큽니다. 50MB 이하로…` | 요청 본문 55MB 초과 — **정상 동작** | 화면은 50MB 를 먼저 막는다. 화면을 거치지 않은 요청이다 |
| 429 JSON `요청이 너무 많습니다. 잠시 뒤…` | 로그인 · 인증코드 경로(`/api/v1/auth/email/*` · `/auth/demo`) Nginx 제한 — IP 마다 분당 20회, 한꺼번에 10회 | 문구가 이것과 다르면 백엔드 throttler 다 ([api.md](../api.md) 「보안」 Rate-limit) |
| 모든 손님이 한꺼번에 429 · 접속 로그 첫 칸이 전부 같은 도커 IP | Nginx 가 사이드카를 못 믿어 손님 IP 대신 사이드카 IP 로 센다 | ADR 0010 「도커 대역 가정」 — 도커가 `172.16.0.0/12` 밖 대역을 줬는지 |
| 배포가 `nginx -t` 에서 실패 | `nginx/default.conf` 문법 오류 | 이때 `up -d` 까지 가지 않아 **기존 nginx 가 옛 설정으로 계속 받는다** |
| 배포가 `nginx health` 에서 실패 | 새 설정으로 다시 만든 nginx 가 healthy 가 아니다 | 워크플로가 남긴 nginx 로그 40줄 |

### 로그 보기

```bash
# 홈서버 ~/apps/life-ledger
docker compose logs --tail 100 nginx       # 접속 로그(쿼리 문자열 없음) + 오류 로그
docker compose logs --tail 50 tailscale
docker compose logs --tail 80 backend
```

- 접속 로그 첫 칸이 손님 IP 다 (`real_ip` 로 바꾼 값).
- **오류 로그 줄에는 쿼리 문자열이 남을 수 있다**(OAuth `code` 등) — 접속 로그만 쿼리를 뺐다. 로그를 어디에 붙여 넣기 전에 본다.

## 조치

### 설정 문법 검사 (손으로)

배포 워크플로와 같은 명령이다.

```bash
docker compose run --rm --no-deps nginx nginx -t
```

### 설정 파일을 바꾼 뒤 반영

`nginx/default.conf` · `tailscale/serve.json` 은 바인드 마운트라, git 이 파일을 바꿔도 돌던 컨테이너는 옛 파일을 본다. **다시 만들어야** 새 파일을 본다. 보통은 main push 때 배포 워크플로가 바뀐 쪽만 다시 만든다.

```bash
docker compose up -d --no-deps --force-recreate nginx
docker compose up -d --no-deps --force-recreate tailscale   # 몇 초 끊긴다
```

### backend · frontend 가 죽어 있을 때

Nginx 문제가 아니다. 배포 실패 · 재배포는 [redeploy-rollback-keys.md](redeploy-rollback-keys.md).

- backend 컨테이너가 다시 만들어져 IP 가 바뀌어도 Nginx 는 재시작할 필요가 없다 — upstream 을 변수 + 도커 DNS(10초 캐시)로 찾는다. 바뀐 직후 10초 안팎은 502 가 날 수 있다.

### Nginx 를 빼고 사이드카가 바로 보내게 되돌리기 *(운영에서 해 보지 않음)*

ADR 0010 「대안」 의 "`serve.json` 만 되돌리면 원래대로". 2026-11-02 전 `tailscale/serve.json` 의 `Handlers` 는 아래였다(`be53a24^`).

```json
"/": { "Proxy": "http://frontend:3000" },
"/api": { "Proxy": "http://backend:8000/api" }
```

- 이렇게 되돌리면 backend 바로 앞이 사이드카가 된다. 사이드카도 `X-Forwarded-For` 를 손님 IP 한 값으로 덮어 보내서(11-02 실측) `TRUST_PROXY=1` 은 그대로 맞다 ([구현 노트](../implementation-notes.md) 「횟수 제한…」).
- 대신 업로드 한도 · 로그인 횟수 제한 · gzip · 접속 로그 같은 Nginx 몫은 사라진다.
- 바꾼 뒤 `tailscale` 을 다시 만든다(위). 영구히 되돌릴 때는 커밋해서 main 배포로 한다.

## 검증

```bash
# tailnet 기기에서 — 200, 응답 헤더에 Server: nginx
curl -sI https://lifeledger.tailba78c1.ts.net/api/v1/health

# 홈서버 — nginx · tailscale · backend · frontend 모두 Up, nginx · backend · frontend 는 healthy
docker compose ps
```

- 브라우저로 운영 로그인 화면이 열리고 로그인된다. 데모는 '데모로 둘러보기'.

## 안 되면

- **사이드카는 떴는데 노드가 tailnet 에 없다** → Tailscale 관리 화면에서 `lifeledger` 노드가 있는지 본다. 노드가 지워졌으면 새 `tag:app` 인증 키가 필요하다 — [redeploy-rollback-keys.md](redeploy-rollback-keys.md) 「Tailscale 인증 키」.
- **운영 · 데모 하나만 안 된다** → 둘은 컨테이너가 따로다. 안 되는 쪽 프로젝트로 `ps` · `logs` 를 본다.
- **홈서버 전체가 꺼졌다 켜졌다** → infra 레포 런북 `docs/runbooks/homeserver-reboot-check.md`.

## 참고

- [ADR 0010](../adr/0010-nginx-behind-tailscale-sidecar.md) — 사이드카 뒤 Nginx · 「위험 · 남은 것」
- [nginx/default.conf](../../nginx/default.conf) · [docker-compose.yml](../../docker-compose.yml) · [tailscale/serve.json](../../tailscale/serve.json)
- [.github/workflows/deploy-home-server.yml](../../.github/workflows/deploy-home-server.yml) — `nginx -t` · 다시 만들기 · nginx healthy 대기
- infra ADR 0006 — 앱마다 사이드카 (비공개 레포)
