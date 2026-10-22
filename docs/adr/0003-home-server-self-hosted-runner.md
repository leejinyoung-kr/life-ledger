# 0003. 운영은 클라우드 대신 홈서버 — self-hosted runner 배포 + 앱 전용 Tailscale 사이드카

- **상태**: 채택 (소급 기록)
- **결정일**: 2026-06-26 (근거 커밋 `f0d2ee1`) · 사이드카는 2026-10-10 (`40670e3`)
- **기록일**: 2026-10-18
- **결정 방식**: 홈서버로 간다는 것은 본인이 비용을 보고 클라우드(AWS) · 미니PC 홈서버 등을 알아본 뒤 골랐다 (2026-10-22 본인 설명, 당시 문서 기록은 없다). 배포 · 접속 구성은 AI 제안 채택

## 맥락

- backend · frontend · DB 를 어디서 돌리고, 코드를 어떻게 배포하고, 밖에서 어떻게 들어올지 정해야 했다.
- 홈서버로 옮기기 6일 전(2026-06-20)에는 클라우드 흔적이 있다 — backend 는 Fly.io(`fly.toml`, 도쿄 `nrt`, `shared-cpu-1x` 256MB), DB 는 TiDB Cloud(`d0d36ca`).

## 당시 결정

| 날짜 | 커밋 | 바뀐 것 |
| --- | --- | --- |
| 06-20 | `3746ba2` · `5a6a0eb` | `fly.toml` 추가, develop push 때 Fly 자동 배포 |
| 06-20 | `d0d36ca` | TiDB Cloud 가 트리거를 지원하지 않아 KST 타임스탬프 트리거 제거 |
| 06-20 | `d40519a` | 256MB 에서 OOM 으로 보이는 재시작 반복 → 512MB |
| 06-26 | `f0d2ee1` | Fly 워크플로를 홈서버 self-hosted runner 배포로 교체 |
| 07-23 | `a36ccd7` | 배포 전에 테스트 |
| 08-01 | `5872013` · `31860ca` | 레포 사이 배포를 `flock` 으로 한 번에 하나만, 바뀐 서비스만 빌드 |
| 10-10 | `40670e3` | 홈서버 노드 Funnel 443(화면) · 8443(API) → 앱 전용 Tailscale 사이드카 하나(`/` · `/api`) |
| 10-13 | `a305bb5` | Dockerfile `chown -R` 제거 — 배포 10 ~ 29분 → 2 ~ 5분 |
| 10-16 | `d9e6ed1` | 배포 끝에 빌드 캐시 · 옛 이미지 정리 |

당시 기록(AI 작성)에 남은 것:

- 홈서버로 옮긴 이유는 커밋에 **없다.** 본인 설명(2026-10-22): 비용 때문에 알아보니 미니PC 는 처음 장비 값만 들이면 고장 나지 않는 한 매달 나가는 돈 없이 오래 쓸 수 있었고, 나만의 홈서버를 만들어 보고 싶었다. `f0d2ee1` 은 사실만 적었다 — "Fly.io hosting is no longer used — backend, frontend, and db all run via docker compose on the mini PC home server now."
- 클라우드 시절 겪은 일: "consistent with an OOM kill on 256mb given sharp/pdf-lib/exceljs/AWS SDK/OpenAI SDK all loading into one process." — `d40519a`. 이것이 옮긴 이유였는지는 기록에 없다.
- 사이드카: "Funnel 은 노드 하나에 443 · 8443 · 10000 세 포트만 연다. 앱마다 포트를 나눠 쓰면 세 개에서 막혀서 … 앱마다 노드(호스트 이름)를 따로 둔다." — infra `README.md` (비공개). "화면과 API 가 같은 origin 이 되므로 코드는 그대로 두고 운영 .env 의 주소만 바꾼다" — `40670e3`
- 체크아웃 방식: "actions/checkout을 쓰지 않고 … .env / backend/.env 는 git에 커밋되지 않으므로, fresh checkout을 쓰면 이 파일들이 사라진다." — 워크플로 주석
- 공개 레포의 runner: "Fork pull request workflows 를 모든 외부 기여자 승인 필요로 둔다", "`pull_request` 트리거를 넣지 않는다" — [공개 준비 계획](../archive/2026-10-13-public-release-plan.md)
- "혼자 쓰는 앱이라 클라우드 비용 대신 집 서버를 쓴다. 공유기 포트를 열지 않고 HTTPS 주소를 받을 수 있다." — [README](../../README.md) 「기술 선택 이유」. 2026-10-15 에 쓴 **사후 설명**이다.

## 지금 코드에 남은 것

- [.github/workflows/deploy-home-server.yml](../../.github/workflows/deploy-home-server.yml) — `main` push · 수동 실행, `runs-on: [self-hosted]`, 홈서버 클론에서 `git reset --hard`, `flock /tmp/deploy.lock`, 빌드 → `check-env` → `migrate deploy` → `crypto-check` → `up -d` → healthy 대기 → 데모 → 정리
- [docker-compose.yml](../../docker-compose.yml) — 포트는 `127.0.0.1` 에만, `tailscale` 서비스(프로필 `homeserver`, 호스트 이름 `lifeledger`)
- [tailscale/serve.json](../../tailscale/serve.json) — `/` → frontend:3000, `/api` → backend:8000, `AllowFunnel: true`
- `backend/Dockerfile` · `frontend/Dockerfile` — 홈서버에서 직접 빌드한다(이미지 레지스트리 없음)

## 지금 검토 — 대안 비교 *(AI 초안 · 본인이 읽고 고친다)*

| 대안 | 장점 | 단점 | 이 프로젝트에 대입하면 |
| --- | --- | --- | --- |
| 클라우드 PaaS + 관리형 DB (Fly.io + TiDB 처럼) | 장비 · 전원 · 디스크 관리가 없다. 공인 HTTPS | 월 비용. 작은 VM 은 메모리가 빠듯하다. 관리형 DB 제약 | 6월에 실제로 이 길로 갔다가 6일 만에 접었다. 256MB OOM · TiDB 트리거 미지원을 겪었다 |
| VPS 하나 + docker compose | 지금 compose 를 그대로 옮긴다. 공인 IP, 집 전원 · 회선과 무관 | 월 비용. 서버 관리는 똑같이 내 몫 | 홈서버 장비가 죽었을 때 가장 현실적인 대피처다 |
| **지금**: 홈서버 + self-hosted runner + 앱별 Tailscale 사이드카(Funnel) | 추가 비용이 거의 없다. 공유기 포트를 안 연다. 앱 여럿을 한 장비에 | 장비 · 전원 · 회선 · 디스크가 단일 장애점. 빌드도 운영 장비에서 한다. 공개 레포에 self-hosted runner 가 붙어 있다 | 사용자 1명이라 몇 시간 멈춰도 감수할 수 있다. 데이터 유실은 감수할 수 없다 |

- **지금 보니 맞는 점 (초안)**
  - 로컬과 운영이 같은 compose 다.
  - 배포 전 점검(`check-env` · `migrate` · `crypto-check`)이 실패하면 `up -d` 까지 안 가서 기존 컨테이너가 계속 돈다.
  - 화면과 API 가 같은 origin 이라 CORS · 쿠키 설정이 단순하다 ([0001](0001-jwt-access-refresh-rotation.md) 의 `SameSite=Lax` 도 이 덕에 된다).
- **아쉬운 점 · 위험 (초안)**
  - 단일 장애점이다. 2026-10-16 빌드 캐시가 165G 까지 쌓여 디스크 84% 를 채웠다 (infra README).
  - DB 덤프(`db_backups` 볼륨)가 같은 장비에 있다. 장비 밖 DB 백업과 장비가 죽었을 때 옮길 곳은 정해 두지 않았다 (2026-10-22 본인 확인). 장비 밖에 있는 것은 업로드 파일(B2)뿐이다.
  - 운영 주소도 Funnel 로 인터넷에 열려 있다. 막는 것은 허용 목록 로그인 · rate limit 이다. 안 열면 휴대폰에도 Tailscale 앱이 필요하다.
  - 빌드를 운영 장비에서 하니 배포 중 CPU 를 서비스와 나눠 쓴다 — `flock` 을 넣은 이유이기도 하다.
  - 공개 레포 + self-hosted runner 는 fork PR 승인 설정 하나에 기대고 있다.

## 다시 정한다면 — 본인 작성

> *비어 있음.* 위 비교를 읽고 같은 선택인지, 바꾼다면 무엇을 왜 바꾸는지 한 줄.
> 생각할 질문:
>
> - 홈서버가 오늘 죽으면 몇 시간 안에, 어디로, 무엇을 들고 옮길 수 있나?
> - 운영 주소까지 Funnel 로 열어 둘 필요가 있나?
> - 이미지를 GitHub Actions(호스티드)에서 빌드해 받기만 하면 무엇이 나아지고 무엇이 어려워지나?

## 참고

- [README](../../README.md) 「해결한 문제 4」 — 배포 시간 단축
- [architecture.md](../architecture.md) 「C4」 Level 2
- [0004](0004-auto-migrate-on-deploy.md) — 배포 중 마이그레이션 · [0006](0006-shared-mariadb-per-app-user.md) — 공용 DB · [0008](0008-separate-demo-instance.md) — 데모
