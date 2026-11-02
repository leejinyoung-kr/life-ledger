# 0006. DB 는 여러 앱이 같이 쓰는 MariaDB 하나 — 앱마다 데이터베이스와 전용 사용자

- **상태**: 채택 (소급 기록)
- **결정일**: 2026-07-18 (같이 쓰기 시작, 근거 커밋 `bae519e`) · 2026-10-05 (`infra` 레포로 분리 · 전용 사용자, `946a6bd`)
- **기록일**: 2026-10-18
- **결정 방식**: 07-18 · 08-23 하나를 같이 쓰기로 한 것은 **본인 결정** (2026-11-02 본인 확인). 10-05 `infra` 분리 · 전용 사용자는 워크스페이스 정리 계획(AI 작성)대로. 당시 대안 검토는 없었다

## 맥락

- 처음(2026-06)에는 이 앱의 compose 안에 MariaDB 가 있었다. MariaDB 를 고른 이유는 기록에 없다.
- 같은 홈서버에 다른 앱(work-nexus, 뒤에 career-notes · safe-box)이 생기면서 DB 를 앱마다 띄울지, 하나를 나눠 쓸지 정해야 했다.

## 당시 결정

| 날짜 | 커밋 | 바뀐 것 |
| --- | --- | --- |
| 06-20 | `bc5d3d5` | DB 포트를 로컬에만 바인딩 |
| 07-18 | `bae519e` | DB 컨테이너 이름을 `nexus-db` 로 — 다른 앱과 같이 쓰기 시작 |
| 08-23 | `420f305` | compose 프로젝트 이름을 `nexus-shared` 로 |
| 10-05 | `946a6bd` | 이 앱 compose 에서 DB 를 빼고 `infra` 레포의 공용 MariaDB 에 전용 사용자로 붙음 ("root 미사용") |
| 10-06 | `22b51fa` | 호스트 포트 13306 (홈서버 23306) |
| 10-15 | `36627b8` | 데이터베이스 · 사용자 `docnexus` → `lifeledger` |

당시 기록에 남은 이유:

- "work-nexus가 같은 MariaDB 서버를 데이터베이스명만 다르게 공유하게 되면서, doc-nexus 전용 이름(doc-nexus-db-1)이 아니라 중립적인 이름으로 고정." — `bae519e` (Claude 공동 작성 표시 없음)
- "work-nexus/nexus-devops-agent가 이 DB를 공유해서 쓰는데 project name이 doc-nexus 전용처럼 보여서 혼동을 줘 nexus-shared로 바꿈" — `420f305` (Claude 공동 작성 표시 없음)
- 분리 전 상태: "MariaDB(`nexus-db`)가 doc-nexus 의 compose 안에 있고 career-notes 가 외부 네트워크로 기댄다 … 두 앱 모두 DB 에 `root` 로 접속한다" / 원칙 "공용 자원은 어느 프로젝트에도 속하지 않는다" — 워크스페이스 정리 계획 §1 · §2 (비공개 메모, AI 작성)
- "MariaDB 서버 하나에 앱마다 데이터베이스와 전용 사용자를 둔다. 앱 사용자는 자기 데이터베이스에만 권한이 있다." / "PostgreSQL처럼 한 앱만 쓰는 것은 그 앱의 compose에 둔다. 두 번째 앱이 쓰게 되면 그때 이리로 옮긴다." — infra `README.md` (비공개)
- "`--all-databases` 대신 데이터베이스별로 뜬다 (`mysql` 시스템 DB 까지 복원하면 initdb 가 만든 앱 사용자가 덮인다)" — 정리 계획 6단계 결과

본인 확인 (2026-11-02): DB 를 같이 쓰기로 한 것은 본인 결정이다 — 프로젝트마다 DB 컨테이너를 띄우는 것보다 MariaDB 하나에 데이터베이스 이름만 달리해 관리하는 편이 편할 것 같아서.

## 지금 코드에 남은 것

- [docker-compose.yml](../../docker-compose.yml) — 외부 네트워크 `infra`, `DATABASE_URL: mysql://lifeledger:…@mariadb:3306/lifeledger?timezone=+09:00`, 비밀번호는 `${DB_PASSWORD}`
- [docker-compose.demo.yml](../../docker-compose.demo.yml) — 데모는 같은 인스턴스의 `lifeledger_demo` 데이터베이스 · 사용자
- `backend/src/maintenance/db-backup-cron.service.ts` — 매일 04시 이 앱 데이터베이스만 `mariadb-dump` → gzip → `db_backups` 볼륨, 30일 보관
- `package.json` 의 `pnpm run db` — `../infra` compose 를 띄운다. 공용이라 끄는 명령은 없다
- 사용자 · 권한 생성은 infra 레포의 `initdb/01-app-databases.sh` (비공개)

## 지금 검토 — 대안 비교 *(AI 초안 · 본인이 읽고 고친다)*

| 대안 | 장점 | 단점 | 이 프로젝트에 대입하면 |
| --- | --- | --- | --- |
| 앱마다 DB 컨테이너 | 장애 · 업그레이드 · 자원이 앱별로 갈린다. 앱 compose 하나로 완결 | 인스턴스 · 메모리 · 백업이 앱 수만큼 는다 | 앱 3 ~ 4개 · 홈서버 1대. 메모리가 실제로 부족한지는 잰 적이 없다 |
| **지금**: 공용 인스턴스 + 앱별 데이터베이스 · 전용 사용자 | 자원을 아낀다. 관리 도구 세션 하나. 앱 하나가 털려도 남의 데이터베이스는 못 읽는다 | 인스턴스 하나가 죽거나 업그레이드되면 모든 앱이 멈춘다. 한 앱의 무거운 쿼리 · 덤프가 남에게 번진다 | 데모 인스턴스도 같은 MariaDB 를 쓴다 ([0008](0008-separate-demo-instance.md)) |
| 관리형 DB | 백업 · 패치 자동 | 비용, 홈서버와 왕복 지연 | 2026-06 TiDB Cloud 를 잠깐 썼다가 트리거 미지원을 겪었다 ([0003](0003-home-server-self-hosted-runner.md)) |

- **지금 보니 맞는 점 (초안)**
  - 앱에서 `root` 를 뺐다. 권한이 자기 데이터베이스로 좁아졌다.
  - DB 가 어느 앱에도 속하지 않아, 이 앱을 내려도 다른 앱 DB 가 살아 있다 (정리 계획 6단계 완료 기준).
- **아쉬운 점 · 위험 (초안)**
  - 단일 장애점이다. MariaDB 버전을 올리면 모든 앱을 같이 검증해야 한다.
  - 백업 책임이 갈렸다 — 앱 데이터베이스는 앱의 예약 작업이 뜨고, infra 덤프는 손으로 뜬다.
  - 타임스탬프가 UTC 로 저장된다는 워크스페이스 규칙과, `DATABASE_URL` 의 `timezone=+09:00` · `f1be58e`(MariaDB 타임존 KST) 가 어떻게 맞물리는지 문서로 정리된 곳이 없다 (확인 필요). → 2026-10-27 확인: `timezone=+09:00` 은 Prisma 어댑터에 효과가 없고 값은 UTC 였다. 2026-10-28 실제 값을 KST 로 옮기는 것으로 정리했다 — infra ADR 0008, 이 레포 `docs/erd.md` 「타임스탬프」.

## 다시 정한다면 — 본인 작성

> *AI 초안 (2026-11-02, 본인 요청으로 AI 가 씀) — 본인 판단이 아니라 기록을 보고 쓴 것이다. 읽고 고치거나 지운다.*

**한 줄**: 같은 선택이다. 홈서버가 한 대라 DB 를 앱마다 나눠도 서버가 죽으면 같이 죽고, 앱 전용 사용자로 `root` 를 뺀 이득은 그대로 남는다. 하나를 나눠 쓰기로 한 이유는 본인 확인으로 남았다 — 앱마다 띄우는 것보다 하나에 데이터베이스 이름만 달리하는 편이 관리하기 편해서.

### 질문과 답

- **공용 MariaDB 가 멈추면 어떤 앱들이 같이 멈추나? 그걸 받아들일 수 있나?**
  이 앱(과 데모), safe-box 서버, track-record 가 같이 멈춘다(`CLAUDE.md` 프로젝트 목록 기준, 각 앱의 DB 연결은 직접 확인하지 않았다). pace-log 는 PostgreSQL 이라 영향이 없고, safe-box 는 PC 로컬 우선이라 서버가 멈춰도 금고는 열린다. 앱마다 DB 컨테이너를 따로 둬도 같은 홈서버 한 대 위라 서버 장애에서는 같이 멈추므로, 받아들일 만하다고 보인다. 막으려는 것은 MariaDB 컨테이너만의 장애와 버전 업그레이드 영향이다.
- **앱 전용 사용자에게 지금 준 권한(`ALL PRIVILEGES` on 자기 DB)은 필요한 만큼인가?**
  필요보다 넓다. `infra/initdb/01-app-databases.sh` 는 자기 DB 에 `ALL PRIVILEGES` 를 주고, `lifeledger` · `safebox` 에는 Prisma 섀도 DB 권한(`prisma\_migrate\_shadow\_db\_%`)도 준다. 런타임은 DML 이면 되지만 같은 사용자가 배포 때 `migrate deploy`(DDL)도 하니 지금 구조에서는 이 정도가 필요하다. 줄이려면 마이그레이션 전용 사용자를 따로 두는 방법이 있다 — 사용자 1명 · 자기 DB 로 제한된 지금은 이득이 작다.
- **데모 데이터베이스를 운영과 같은 인스턴스에 두는 것이 괜찮나?**
  데이터는 갈려 있다 — 데이터베이스 `lifeledger_demo` 와 전용 사용자가 따로고(ADR 0008), 백업 덤프에서도 빠진다(infra `dump-all.sh`). 공유하는 것은 인스턴스의 자원 · 장애다. 누구나 들어오는 데모의 무거운 쿼리가 운영 DB 에 번질 수 있으나, 방문자가 몇 명뿐이라 문제 된 적은 기록에 없다. 데모 사용자의 권한이 자기 DB 로만 한정됐는지는 직접 확인하지 않았다.

## 참고

- [CLAUDE.md](../../CLAUDE.md) 「운영 배포 (홈서버)」 — `DB_PASSWORD` 와 infra 쪽 비밀번호가 같아야 한다
- [architecture.md](../architecture.md) 「C4」 Level 2
- [0003](0003-home-server-self-hosted-runner.md) · [0008](0008-separate-demo-instance.md)
