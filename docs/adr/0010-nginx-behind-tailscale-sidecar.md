# 0010. 사이드카 뒤에 Nginx 를 둔다 — 사이드카는 길 · 주소 · 인증서만, 경로 나누기 · 제한은 Nginx

- **상태**: 채택 — 2026-11-02 develop 에 반영 (main 배포 때 적용)
- **결정일**: 2026-11-02
- **기록일**: 2026-11-02
- **결정 방식**: 세 단계로 정했다.
  - 할지 · 어느 앱에 · 어떤 모양으로: AI 가 셋을 비교했다 — A 사이드카 뒤 Nginx · B 공용 Nginx + 경로로 앱 나누기 · C 내 도메인 + Nginx. AI 는 **A, life-ledger 에만** 을 추천했고 사용자가 "이대로 진행" 했다 (2026-11-02). 계기는 사용자 — "Nginx 는 한 번도 써 본 적이 없다. 이직 공부하며 나온 것이라 개인 프로젝트에 넣어 보고 싶다. 가치 있는 앱에만" (2026-11-02 대화). 검토 문서 `TODO/web/개인프로젝트_세션_Nginx_전환_검토.md` 2절
  - 세부 셋: AI 가 각각 대안을 보여 주고, 사용자가 셋 다 AI 추천안을 골랐다 — 데모도 Nginx 뒤로(대안: 데모는 사이드카 그대로), 범위는 옮기기 + 로그인 경로 횟수 제한 + gzip(대안: 옮기기만 · 보안 헤더 CSP 까지), ADR 은 이 레포(대안: infra)
  - 그 밖의 값(아래 「결정」 3 ~ 6)은 구현하며 AI 가 정했다

## 맥락

- 외부 접속은 앱 전용 Tailscale 사이드카다 ([0003](0003-home-server-self-hosted-runner.md) · infra ADR 0006). 사이드카가 두 가지 일을 했다 — ① 길 · `*.ts.net` 주소 · 인증서 · Funnel(공개 여부), ② 입구 — `/` 는 frontend, `/api` 는 backend (`tailscale/serve.json`).
- ①은 Nginx 가 못 한다. ②는 Nginx 가 할 수 있고, 거기에 업로드 크기 · 요청 횟수 · 응답 시간 · 압축 · 접속 로그 같은 앞단 일을 얹을 수 있다.
- 다른 앱을 뺀 이유 (검토 문서): track-record · safe-box 는 tailnet 전용이라 앞단에서 막을 손님이 없고, safe-box 는 `/api` 하나뿐이다. life-ledger 는 Funnel 로 공개돼 있고 데모는 누구나 들어온다.
- 데모는 운영과 같은 `docker-compose.yml` · `tailscale/serve.json` 을 쓴다 ([0008](0008-separate-demo-instance.md)). 데모만 빼려면 덮어쓰기가 늘어난다.
- 전제였던 `TRUST_PROXY` 는 2026-11-02 바로잡았다 — `docs/implementation-notes.md` 「횟수 제한이 모든 접속을 한 사람으로 세던 문제」.

## 결정

1. **사이드카는 전부 Nginx 로 보낸다** (`serve.json` 의 `/` → `http://nginx:80` 하나). 주소 · 인증서 · Funnel 은 그대로다. 데모도 같은 설정으로 Nginx 뒤에 선다.
2. **Nginx 가 맡는 것** (`nginx/default.conf`):
   - 길 나누기 — `/api/` → backend:8000, 나머지 → frontend:3000
   - 업로드 한도 55MB (백엔드 한도 50MB + multipart 머리 몫). 기본 1MB 면 파일 업로드가 413 이다
   - 응답 기다리는 시간 300초 (기본 60초면 큰 ZIP 내보내기가 첫 바이트 전에 끊길 수 있다)
   - 로그인 · 인증코드 경로(`/api/v1/auth/email/*` · `/auth/demo`) 횟수 제한 — IP 마다 분당 20회, 한꺼번에 10회까지. 백엔드 throttler(분당 5 ~ 10회)보다 넉넉하게 두어, 평소엔 백엔드가 막고 Nginx 는 쏟아지는 요청만 막는다
   - API 응답 gzip (화면은 Next.js 가 스스로 압축한다)
   - 접속 로그 (쿼리 문자열은 빼고 — OAuth `code` 가 남지 않게)
3. **진짜 IP 는 Nginx 에서 정하고 뒤로는 한 값만 넘긴다.** 사이드카(도커 대역 `172.16.0.0/12`)가 보낸 `X-Forwarded-For` 만 믿고(`real_ip`), 백엔드에는 `X-Forwarded-For: <손님 IP>` 하나로 덮어 보낸다. 그래서 백엔드 `TRUST_PROXY=1` 이 그대로 맞고, 첫 값을 직접 읽는 기기 목록 · 접근 로그도 그대로 손님 IP 다. (검토 때 적은 "Nginx 를 끼우면 2" 는 Nginx 가 덧붙이는 경우의 이야기다.)
4. **Nginx 가 직접 막을 때(413 · 429)도 `{ statusCode, message }` JSON** 으로 돌려준다 — 화면은 `message` 를 읽어 보여 준다.
5. **upstream 주소는 변수 + 도커 DNS(`resolver 127.0.0.11 valid=10s`)** 로 찾는다. 배포로 backend 컨테이너가 다시 만들어져 IP 가 바뀌어도 Nginx 를 재시작할 필요가 없다. 변수 없이 쓰면 Nginx 가 켤 때 한 번 찾은 IP 를 계속 써서 502 가 난다.
6. **배포**: 이미지 `nginx:1.30.6-alpine` 고정(1.30 이 stable 줄). 배포 워크플로가 `nginx -t` 로 문법을 먼저 검사하고, `nginx/` · `tailscale/` 이 바뀌었으면 그 컨테이너를 다시 만든다 — 설정 파일이 바인드 마운트라 git 이 새 파일로 바꿔도 돌던 컨테이너는 옛 파일을 본다. healthcheck 는 루프백 전용 `127.0.0.1:8081/health` (사이드카로는 닿지 않는다).

## 지금 코드에 남은 것

- [nginx/default.conf](../../nginx/default.conf) — 위 2 ~ 5
- [docker-compose.yml](../../docker-compose.yml) — `nginx` 서비스(프로필 `homeserver`), `tailscale` 은 `nginx` healthy 를 기다린다
- [tailscale/serve.json](../../tailscale/serve.json) — `/` → `nginx:80`
- [.github/workflows/deploy-home-server.yml](../../.github/workflows/deploy-home-server.yml) — 경로 `nginx/**`, `nginx -t`, 바뀌면 다시 만들기, nginx healthy 대기 (운영 · 데모)
- 확인 (2026-11-02, 로컬): 같은 이미지로 Nginx 를 띄우고 받은 헤더를 그대로 돌려주는 가짜 backend · frontend 를 붙여 봤다 — `/api` · `/` 길, `X-Forwarded-For` 를 손님 값 하나로 넘김(`1.1.1.1, 9.9.9.9` 가 오면 마지막 값), `X-Forwarded-Proto` · `Host` 전달, 로그인 경로 15번 연속 → 11번 통과 · 4번 429 JSON · 다른 IP 는 통과, 다른 경로는 15번 다 통과, 60MB 업로드 413 JSON · 50MB 통과, 3KB JSON gzip, backend 컨테이너를 IP 가 바뀌게 다시 만들어도 재시작 없이 따라감, 접속 로그에 쿼리 값 없음

## 위험 · 남은 것

- **입구가 둘이다** — 사이드카와 Nginx. 접속이 안 될 때 어느 쪽인지 먼저 갈라 봐야 한다: 사이드카 로그(`docker compose logs tailscale`) → Nginx 접속 로그 → 백엔드.
- **화면은 Nginx 가 모아 두지 않는다** (`proxy_buffering off`) — Next.js 가 나눠 보내는 응답을 그대로 흘린다. API 는 기본(모아 두기)이다.
- **도커 대역 가정** — `set_real_ip_from 172.16.0.0/12` 는 도커 기본 대역이다. 도커가 `192.168.x` 대역을 주면 사이드카를 못 믿어 모든 IP 가 사이드카 것으로 보인다 (지금 운영 172.21 · 데모 172.24, 11-02 확인).
- **Nginx 오류 로그에는 쿼리가 남을 수 있다** — 접속 로그만 쿼리를 뺐다. 오류 로그는 요청 줄 전체를 적는다.
- **Nginx 횟수 기록은 메모리** — 컨테이너를 다시 만들면 처음부터 센다. 백엔드 throttler 도 같다.
- 백엔드가 멈췄을 때의 502 · 504 는 Nginx 기본 HTML 이다 — 화면에는 "요청 실패 (502)" 로 보인다.
- 확인 (2026-11-02, 운영 배포 `be53a24`): 운영 · 데모 nginx healthy, health 200 · 응답 `Server: nginx`, 화면 307 → `/dashboard`. 백엔드가 받는 `X-Forwarded-For` 는 접속한 tailnet IP 한 값이고 손님이 지어 보낸 `1.2.3.4` 는 사라진다(tcpdump). 로그인 경로 25번 연속 → 11번 백엔드까지 · 14번 Nginx 429 JSON
- 확인 (2026-11-02, 운영 · 본인): 로그인, 파일 보관함 10MB 업로드(Nginx 기본 1MB 였다면 막혔을 크기), 설정 > 전체 백업 ZIP 다운로드, 데모 로그인 모두 됨. 60MB 는 화면이 먼저 막았고("50MB 를 넘는 파일만 있습니다"), 화면을 거치지 않은 60MB 요청은 운영 Nginx 가 413 JSON 으로 막았다(AI, curl)

## 지금 검토 — 대안 비교 *(AI 초안 · 본인이 읽고 고친다)*

| 대안 | 장점 | 단점 | 이 프로젝트에 대입하면 |
| --- | --- | --- | --- |
| **지금**: A 사이드카 뒤 Nginx | 바꿀 양이 적다(컨테이너 하나 · 설정 파일 하나), 주소 · OAuth · 공개 범위 그대로, `serve.json` 만 되돌리면 원래대로 | 입구가 둘, Nginx 를 거치는 한 칸이 늘어난다 | 사용자 몇 명이라 성능 차이는 없다. 얻는 것은 앞단 제한 · 로그 · Nginx 설정 경험 |
| B 공용 Nginx + 경로로 앱 나누기 | Nginx 하나로 모든 앱 | 앱마다 `basePath` · OAuth 주소 · 쿠키 경로가 바뀐다. safe-box 만 tailnet 전용으로 닫기가 안 된다 | 앱 하나 = 주소 하나(infra ADR 0006)와 부딪친다 |
| C 내 도메인 + Nginx | 회사 구성과 가장 비슷 — 도메인 · 인증서 · 공개 운영 | 도메인 비용, 포트를 열면 집 IP 노출, tailnet 보호가 사라져 safe-box · track-record 를 따로 막아야 | 공부로는 가장 크지만 바꿀 것도 가장 많다 |
| Nginx 없음 (이전) | 입구가 하나, 부품이 적다 | 업로드 · 횟수 제한은 백엔드만, 앞단 로그가 없다 | 지금 규모에서는 이것도 충분했다 — 이번 결정은 공부가 주 목적이다 |

## 다시 정한다면 — 본인 작성

> *비어 있음.* 위 비교를 읽고 같은 선택인지, 바꾼다면 무엇을 왜 바꾸는지 한 줄.
> 생각할 질문:
>
> - 백엔드에도 throttler 가 있는데 Nginx 에서 또 막는 이유는? 어느 쪽이 먼저 막는 게 좋은가?
> - Nginx 가 `X-Forwarded-For` 를 덧붙이지 않고 덮어쓰면 무엇이 좋아지고, 무엇을 믿는 셈인가?
> - `proxy_pass` 에 주소를 바로 쓰지 않고 변수를 쓴 이유는?

## 참고

- 검토 문서 `TODO/web/개인프로젝트_세션_Nginx_전환_검토.md` (develop 워크스페이스) · 정리본 project-history `개인/공부/6_네트워크_보안.md` 6절(웹 서버 · WAS)
- [0003](0003-home-server-self-hosted-runner.md) 홈서버 · 사이드카 · [0008](0008-separate-demo-instance.md) 데모 · infra ADR 0006 앱마다 사이드카
- `docs/implementation-notes.md` 「횟수 제한이 모든 접속을 한 사람으로 세던 문제」 (`TRUST_PROXY`)
