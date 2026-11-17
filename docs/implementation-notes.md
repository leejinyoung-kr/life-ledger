# 구현 노트

결정(ADR) · 사고(포스트모템)는 아니지만 설명할 거리가 있는 개선을 남긴다 — 문제 · 원인 · 고친 방법 · 일부러 안 고친 곳.

## 이름 변경 — life-ledger → life-moa (2026-11-17)

워크스페이스 이름 규칙(레포는 쉬운 영어 두 단어, 화면은 한글)에 따라 레포 · 화면 · 서버 이름을 모두 바꿨다. doc-nexus → life-ledger(2026-10-15) 때 그대로 두었던 볼륨 · B2 버킷 이름까지 이번에 새 이름으로 맞췄다.

- **바꾼 것:** 레포 `life-moa`, 화면 이름 「생활모아」(제목 · 글자 로고 · 앱 설치 이름 · 푸시 · 메일 · Swagger), JWT `iss`/`aud` `life-moa`, 데모 사용자 `demo@life-moa.local`, 백업 파일 접두사 `lifemoa_`, 내보내기 파일 이름, 서비스워커 캐시 이름. 홈서버 `~/apps/life-moa` · `~/runners/life-moa` · 러너 `homeserver-life-moa`(그전 이름은 `homeserver`), compose `life-moa` · `life-moa-demo`, DB · 사용자 `lifemoa` · `lifemoa_demo`, Tailscale 노드 `lifemoa` · `lifemoa-demo`, 볼륨 `life-moa_db_backups` · `life-moa_tailscale_state`, B2 버킷 `life-moa` · `life-moa-demo`, infra 비밀번호 키 `LIFEMOA_DB_PASSWORD` · `LIFEMOA_DEMO_DB_PASSWORD`
- **옮긴 방법 (홈서버, 운영 · 데모가 멈춘 시간 약 15분):**
  1. 러너를 먼저 옮겼다 — 사용자가 `svc.sh stop` · `uninstall` · `mv`, AI 가 GitHub 의 옛 러너를 API 로 지우고 `bin` · `externals` 링크를 다시 걸고 `.runner_migrated` 를 지운 뒤 새 이름으로 등록, 사용자가 `svc.sh install` · `start` (infra README 「홈서버 폴더」)
  2. 새 클론 `~/apps/life-moa` 에 `.env` 4개를 복사하고, 주소 · DB 이름이 든 키만 새 이름으로 바꿨다(값은 출력하지 않음). B2 키 · 버킷은 사용자가 새 값으로 넣었다
  3. 옛 backend 둘을 멈추고 덤프 → `~/backups/2026-11-17/lifeledger(_demo)-before-rename.sql`. DB 는 infra `scripts/rename-db.sh` 로 옮겼다 — `RENAME TABLE` 한 문장이라 표가 한꺼번에 옮겨지고, 새 사용자는 옛 사용자의 인증 정보를 그대로 복사한다(비밀번호를 다루지 않는다). 표 26개씩, 인증 정보 같음
  4. B2 는 버킷 이름을 바꾸는 기능이 없어 새 버킷으로 복사했다. 홈서버에서 `rclone` 컨테이너에 옛 · 새 클론의 `.env` 값을 환경 변수로만 넘겨 `copy` → `check`(크기 · MD5) — 객체 74개(53.3MB) 모두 같고, DB 의 지워지지 않은 파일 키 57개가 새 버킷에 다 있다. DB 는 버킷 이름 없이 키(`users/{id}/{uuid}/{파일}`)만 갖고 있어 고칠 것이 없었다. 데모 버킷은 비어 있어 빈 새 버킷으로 시작했다
  5. 백업 볼륨은 옛 `doc-nexus_db_backups` 의 31개를 새 볼륨으로 복사했다. 옛 `lifeledger_` 파일은 보관 기간 정리에 넣어 30일 뒤 저절로 지워진다
  6. 옛 컨테이너를 모두 멈추고 main 에 합쳐 배포. 데모 노드는 `.env.demo` 의 `TS_AUTHKEY` 로 붙었고, 운영 `.env` 에는 키가 없어(처음 붙은 뒤 지움) 데모 키 줄을 잠깐 복사해 붙인 뒤 다시 지웠다
  7. 사용자 crontab 의 데모 초기화 줄을 새 경로 · 프로젝트 이름 · 로그 태그 `life-moa-demo` 로 바꾸고 한 번 돌려 확인했다(데모 사용자 `demo@life-moa.local`). infra `.env` 는 키 이름만 바꿨다(홈서버 · 로컬)
- **막혔던 곳:**
  - `rclone` 이 복사 전에 새 버킷을 만들려다 403 — 버킷 하나에만 권한이 있는 키라 정상이다. 원격마다 `no_check_bucket` 을 켜서 넘겼다
  - 처음에는 `B2_BUCKET_NAME` 에 키 이름이 들어가 `NoSuchBucket` 이었다. 버킷 전용 키는 버킷 목록도 못 봐서 키로 이름을 알아낼 수 없다 — 사용자가 고쳐 넣었다
- **외부 설정 (사용자):** Google OAuth 클라이언트에 새 리디렉션 URI · JavaScript 원본 추가, 동의 화면 앱 이름 「생활모아」. 레포 홈페이지 링크는 새 데모 주소로 바꿨다
- **주소가 바뀌어 생기는 것:** 쿠키 · PWA 설치 · 웹 푸시 구독이 모두 새 origin 에서 다시 시작한다 — 새 주소에서 다시 로그인 · 앱 설치 · 푸시 켜기. 옛 주소의 푸시 구독은 보안 화면에서 옛 세션을 지우면 같이 지워진다(`push_subscription` 은 세션에 CASCADE)
- **일부러 안 바꾼 곳:** ADR · 포스트모템 · 시안(`docs/design/`) · 끝난 계획(`docs/archive/`) · 마이그레이션 SQL 주석 · README 「AI 가 한 것 / 내가 한 것」의 지난 기록은 그때 이름 그대로 둔다. 데모 `backend/.env.demo` 의 `DATABASE_URL` 은 doc-nexus 때 값이 남아 있지만 compose 가 덮어쓰는 값이라 두었다
- **정리 끝 (2026-11-17, 사용자 확인 · 지시):** 새 주소에서 로그인 · 데이터 · 파일 확인(사용자) 뒤 옛 컨테이너 8개 · 네트워크 2개 · 이미지 4개(약 4.3GB) · 볼륨 `doc-nexus_db_backups` · `doc-nexus_tailscale_state` · `life-ledger-demo_tailscale_state` · 클론 `~/apps/life-ledger` · 러너 안 옛 작업 폴더(`doc-nexus` · `life-ledger`)를 지웠다. 비어 있던 옛 DB · 사용자 `lifeledger` · `lifeledger_demo` 는 홈서버 · 로컬 모두 지웠다 — 이전 직전 덤프 `~/backups/2026-11-17/lifeledger(_demo)-before-rename.sql` 은 남겼다. 옛 Tailscale 노드 2개 · 옛 B2 버킷 2개와 키 · Google OAuth 의 옛 주소는 사용자가 지웠다

## 횟수 제한이 모든 접속을 한 사람으로 세던 문제 (2026-11-02)

### 문제

운영 `TRUST_PROXY` 가 비어 있었다(부팅 로그 `(미설정)`). 그래서 Express 의 `req.ip` 가 손님이 아니라 Tailscale 사이드카 컨테이너 IP 였고, 이것을 키로 쓰는 `@nestjs/throttler`(전역 분당 120회 · 보관함 열람 같은 엄격 제한)가 모든 접속을 한 묶음으로 셌다. 한 사람이 제한에 걸리면 다른 기기도 같이 막히고, 반대로 사람마다 따로 막지도 못한다.

### 원인

- 운영 `backend/.env` 의 `TRUST_PROXY=` 줄이 비어 있었다(언제부터인지는 기록에 없다). 비면 `trust proxy` 를 켜지 않아 `req.ip` 가 `X-Forwarded-For` 를 보지 않는다. 데모 `backend/.env.demo` 도 같았다
- 기기 목록 · 접근 로그는 멀쩡해 보여 드러나지 않았다 — 이 둘은 `req.ip` 가 아니라 `X-Forwarded-For` 첫 값을 직접 읽는다(`auth.controller.ts` · 코어 `ClientInfo`)
- `main.ts` 주석이 "x-forwarded-for 의 첫 값을 client IP 로" 라고 적어 실제 동작(숫자면 오른쪽부터 홉 수)과 달랐다

### 고친 방법

- 사이드카가 무엇을 넘기는지 먼저 찍었다 — 백엔드 컨테이너 네트워크에 붙인 일회용 `alpine` + tcpdump 로 헤더만 걸러서(쿠키 · 토큰은 컨테이너 밖으로 안 나가게). 사이드카는 `X-Forwarded-For: <접속한 tailnet IP>` 를 붙이고, 손님이 지어 보낸 `X-Forwarded-For: 1.2.3.4` 는 **덮어쓴다**
- 그래서 `TRUST_PROXY=1`(오른쪽 한 홉 = 사이드카만 믿음). `true` 는 맨 왼쪽 값을 믿어 손님이 지어 넣으면 속으니 쓰지 않는다
- 홈서버 `backend/.env` 와 데모 `backend/.env.demo` 둘 다 `TRUST_PROXY=1` 로 넣고, 수동 배포(`workflow_dispatch`)로 운영 · 데모를 다시 띄웠다 (같은 날)
- `main.ts` · `.env.example` 주석을 실제 동작대로 고쳤다
- 확인 (운영, 2026-11-02): 개발 PC 에서 `/api/v1/health` 를 125번 → 120번 200 · 5번 429(전역 분당 120회). 바로 이어 홈서버 호스트(다른 tailnet IP)에서 같은 주소 → 200, 개발 PC 는 여전히 429. 손님마다 따로 센다
- **같은 날 뒤이어 사이드카와 backend 사이에 Nginx 를 끼웠다** ([ADR 0010](adr/0010-nginx-behind-tailscale-sidecar.md)). 이제 backend 바로 앞은 nginx 다. nginx 가 사이드카의 `X-Forwarded-For` 로 손님 IP 를 찾고(`real_ip`), backend 에는 `X-Forwarded-For: <손님 IP>` 한 값으로 **덮어** 보낸다(`proxy_set_header X-Forwarded-For $remote_addr`). 그래서 값은 그대로 1(오른쪽 한 홉 = nginx 가 넘긴 값). 주석도 이 기준으로 고쳤다. 배포 뒤 backend 가 받은 헤더가 손님 tailnet IP 하나이고, 지어 넣은 값은 빠진 것을 같은 방법으로 확인했다

### 일부러 안 고친 곳

- 기기 목록 · 접근 로그의 "첫 값 직접 읽기" — 앞단이 한 값으로 덮어쓰는 동안은 안전하다. 처음엔 사이드카가, Nginx 를 끼운 뒤로는 nginx 가 덮어쓴다. 앞단이 덧붙이는 프록시로 바뀌면 다시 본다
- Funnel(공개 인터넷) 접속도 같다 — tailnet 밖 휴대폰(사파리)으로 데모 health 를 열고 같은 방법으로 찍었더니 `X-Forwarded-For: <휴대폰 공인 IP>` (2026-11-02). 가짜 헤더를 덮어쓰는지는 휴대폰 브라우저로 보낼 수 없어 tailnet 쪽 결과로 갈음한다

## DB 시각을 KST 벽시계로 옮김 (2026-10-28)

### 문제

HeidiSQL 로 운영 DB 를 보면 `created_at` 등이 한국 시간보다 9시간 이르게 보였다. 컬럼 코멘트는 `생성일(KST)` 인데 실제 값은 UTC 였다. 결정은 infra ADR 0008 (UTC 유지 · TIMESTAMP · 실제 값 KST 중 KST).

### 원인

Prisma 7 `@prisma/adapter-mariadb` 는 시각을 늘 `getUTC*` 로 적고, 읽을 때 `Z` 를 붙인다. 연결 URL 의 `timezone=+09:00` 은 이 어댑터에 효과가 없다.

### 고친 방법

- 서비스 코드에서 9시간을 더하지 않고 **연결 층 한 곳**에서 바꿨다 — `withKstDateTime(new PrismaMariaDb(url))` (young-core `core-db`). 시각 인자 +9시간, 결과의 시각 열 −9시간. `@default(now())` · `@updatedAt` 도 Prisma 가 인자로 넘겨서 같이 옮겨진다
- `@db.Date` 열은 어댑터가 넘기는 `dbType: 'DATE'` · 결과 열 종류(Date)로 걸러 옮기지 않는다 — 조건(`where date gte`) 인자에도 `dbType` 이 붙는 것을 실험으로 확인했다
- 기존 데이터는 마이그레이션 하나에 `UPDATE … + INTERVAL 9 HOUR` 만 넣고 한 트랜잭션으로 (25개 표 · 65개 열, DB `information_schema` 와 `schema.prisma` 를 대조). 시각 열이 들어간 유니크 인덱스 · `ON UPDATE` · 트리거가 없어 행마다 바꾸는 중간에 충돌할 곳이 없다
- 어댑터 · 클라이언트 · CLI 를 7.10.0 으로 고정 — 감싸기가 어댑터의 인자 · 행 모양에 기대서, 올릴 때는 core-db 테스트부터
- 어댑터를 만드는 곳(앱 · `prisma/seed.ts` · `prisma/demo-reset.ts` · `scripts/`)이 감싸지 않으면 `prisma.service.spec.ts` 가 실패한다
- 운영 전환은 백엔드를 멈춘 뒤 배포 — 옛 컨테이너가 도는 채로 마이그레이션하면 그 사이 UTC 가 섞인다

### 일부러 안 고친 곳

- 서비스 코드 · 화면 · API 응답(`…Z`) — 앱이 받는 시점이 그대로라 손댈 것이 없다
- `_prisma_migrations` — Prisma CLI 가 직접 쓰는 표라 UTC 그대로 남는다
- raw SQL 의 `Date` 인자는 `dbType` 이 없어 시각으로 본다. 지금 raw SQL(재암호화 · health · 데모 초기화)은 시각 열을 다루지 않는다

## 모달이 닫히는 동안 내용이 바뀌어 보이던 문제 (2026-10-27)

### 문제

일정 수정 창을 취소 · X · 저장으로 닫으면 순간 제목이 "일정 추가"로 바뀐 뒤 닫혔다 (사용 중 발견). 모달 전체를 확인하니 같은 종류가 둘 더 있었다.

| 창 | 증상 |
| --- | --- |
| 캘린더 일정 수정 | 닫을 때 제목이 "일정 추가"로 바뀜 |
| 계정 보관함 계정 수정 | 저장할 때 제목이 "계정 추가"로 바뀜 |
| 파일 보관함 폴더 생성 | 닫을 때 입력한 이름이 먼저 지워짐 |

상세 창(일정 · 계정 · 파일 · 알림)은 반대로 흐려지지 않고 바로 사라져, 수정 창들과 닫히는 모양이 달랐다.

### 원인

`components/Modal` 은 닫혀도 DOM 에 남아 투명도 전환으로 흐려진다 (`transition-opacity`, 약 0.15초). 그런데 여는 쪽이 닫을 때 창이 쓰는 상태까지 비웠다.

- `setAddModal({ open: false })` 처럼 상태를 통째로 바꾸면 수정 중인 일정이 사라져, 흐려지는 동안 추가 창으로 다시 그려진다
- 폴더 생성은 닫을 때 이름 칸을 비웠다
- 상세 창은 값이 `null` 이면 아예 그리지 않아(`if (!event) return null`, `{detail && <Modal open …>}`) 흐려질 틈 없이 사라졌다

다른 수정 창(구독 · 가계부 · 예적금 · 투자 · 즐겨찾기)은 처음부터 `setX((s) => ({ ...s, open: false }))` 로 닫아서 괜찮았다.

### 고친 방법

- 닫을 때는 `open` 만 끈다 — `setX((s) => ({ ...s, open: false }))`. 다음에 열 때 새 값으로 덮인다. 폴더 이름은 열 때 비운다
- 상세 창은 `lib/useLastValue` 로 마지막 값을 들고 그린다. `open={!!x}` 로 여닫아서 `x` 가 `null` 이 돼도 흐려지는 동안 내용이 그대로 보인다
- 상세 창이 DOM 에 남게 되면서, 닫은 뒤 포커스가 가려진 창 안에 남는 경우가 생겼다. 연 요소가 다시 그려졌거나(캘린더 목록) 포커스를 못 받는 요소(알림 행)일 때다 — 콘솔에 `Blocked aria-hidden … descendant retained focus` 경고. `Modal` 이 닫힐 때 포커스가 아직 창 안이면 빼도록 했다
- 다시 생기지 않게 `frontend/__tests__/ui-conventions.test.ts` 에 규칙을 넣었다: `set…({ open: false` 금지, `<Modal open>` 고정 금지, `open={!!x}` 인 파일은 `useLastValue` 사용. 고치기 전 코드에 돌리면 세 곳이 모두 걸린다

확인은 localhost 에서 창을 닫는 동안 매 프레임(`requestAnimationFrame`) 보이는 창 제목 · 입력값과 반투명 프레임 수를 모아 봤다. 파일 보기 창은 로컬에 파일이 없어 화면으로는 보지 못했다 (같은 방식이고 규칙 테스트는 통과).

### 일부러 안 고친 곳

- **확인 창(`ConfirmModal`)** 은 닫히면 지금처럼 바로 사라진다. 보관함 잠금 해제 · 파일 비우기처럼 안에 입력칸 · 오류 문구를 넣는 곳이 있어, 흐려지게 바꾸면 같은 문제를 새로 만든다
- **계정 상세의 비밀번호 원문** 은 닫는 순간 지운다. 흐려지는 동안 비밀번호 칸은 가린 점으로 보인다 — 원문을 닫힌 창에 남기지 않으려고 원문 · TOTP 를 받고 지우는 effect 는 실제 값을 따른다
- **파일 보기 창** 은 닫힌 뒤에도 마지막 미리보기(이미지 · PDF)가 보이지 않는 채 DOM 에 남는다. 다른 파일을 열면 바뀐다
