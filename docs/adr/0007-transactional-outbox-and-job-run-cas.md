# 0007. 알림 푸시는 트랜잭션 아웃박스로, 예약 작업은 실행 기록 테이블로 — 둘 다 compare-and-swap 으로 선점

- **상태**: 채택 (소급 기록)
- **결정일**: 2026-09-20 (근거 커밋 `781c536` 아웃박스 · `1958a1a` 예약 작업)
- **기록일**: 2026-10-18
- **결정 방식**: AI 제안을 그대로 채택 — 당시 대안 검토는 없었다

<!-- 본인 참고: 회사에서 다룬 "커밋 전에 나간 알림" 문제(afterCommit 으로 지연)와 같은 문제를 다른 방법으로 푼 것이다. 두 방법을 비교해 본다. -->

## 맥락

- **알림 + 웹 푸시**: 2026-06-09(`e4a1115`)부터 "알림 크론·새 기기 로그인 시 푸시 동시 발송" 이었다. 알림 행 저장과 푸시 발송이 따로 돌았다.
- **예약 작업**: 9개 크론이 `@nestjs/schedule` 의 `@Cron` 으로 돌았다. 실행 기록 · 겹침 방지 · 멈춘 실행 처리가 따로 없었다.
- 둘 다 "같은 일을 두 번 하거나, 한 번도 안 하거나, 멈춘 채 남는" 경우를 어떻게 다룰지 정해야 했다.

## 당시 결정

| 대상 | 커밋 | 고른 것 |
| --- | --- | --- |
| 알림 푸시 | `781c536` | 알림 행을 만드는 트랜잭션에 `outbox_message` 행을 같이 넣는다. 발송기는 대기 행을 compare-and-swap 으로 선점해 보내고, 실패하면 재시도, 끝내 실패하면 `/logs` 에 남긴다. 멱등 키 `noti:<알림 id>` |
| 예약 작업 | `1958a1a` | 실행마다 `job_run` 1행. `running_key` 유니크로 같은 작업의 동시 실행을 막고, 마감은 `running` 인 행만 바꾼다(CAS). lease 가 지나면 `failed(lease_expired)` 로 마감 |

당시 기록(AI 작성)에 남은 이유:

- "저장이 롤백되면 푸시도 나가지 않고, 발송 실패는 재시도된다." / "한 기기라도 성공하면 성공 처리 — 재시도로 중복 푸시가 가지 않게" — `781c536`
- "보장은 at-least-once … 같은 내용이 두 번 가는 것보다 안 가는 게 나쁜 알림이라 이쪽을 골랐다." / "시간 창이 아니라 도메인 식별자(`noti:1234`)로 중복 적재를 막는다" / "발송은 순차로 한다 — 외부 발송처에 한꺼번에 몰리지 않게." — [core-libraries.md](../core-libraries.md) §3
- "후보를 고른 뒤 행마다 pending → sending 으로 바꿔 본다. 바뀐 행만 이 프로세스 것이다" — [outbox.store.ts](../../backend/src/push/outbox.store.ts) 주석
- "running 인 행만 바꾼다(compare-and-swap) — lease 만료로 이미 마감된 행을 늦게 끝난 결과가 덮지 않게" — [job-run.store.ts](../../backend/src/maintenance/job-run.store.ts) 주석
- "기록 없이는 실행하지 않는다: 시작 기록에 실패하면 건너뛴다 — 기록 없이 돌면 겹침 방지와 lease 마감이 둘 다 깨진다." — [core-libraries.md](../core-libraries.md) §2
- 검증 기록: "강제 종료로 running 에 남긴 실행을 다른 프로세스가 겹쳐 돌지 않고 lease 뒤 failed(lease_expired)로 마감" — `1958a1a`
- 예외: "즉시 결과를 봐야 하는 것(설정 화면의 테스트 푸시, 로그인 인증코드 메일)만 예외로 바로 보낸다." — [CLAUDE.md](../../CLAUDE.md) 「알림 + 푸시」

## 지금 코드에 남은 것

- [notification/notification.service.ts](../../backend/src/notification/notification.service.ts) — `createWithPush()`: `$transaction` 안에서 알림 생성 + `push.enqueue(tx, …)`, 커밋 뒤 `flush()`(기다리지 않음)
- [push/outbox.store.ts](../../backend/src/push/outbox.store.ts) — `enqueue`(유니크 충돌 P2002 = 이미 적재) · `claim`(`updateMany where status='pending'`) · `markSent` / `markFailed`(`where status='sending'`) · `releaseClaims`(선점 시간이 지난 `sending` 을 되돌림)
- `push/webpush.channel.ts` — 발송 채널. 아웃박스 본체(폴링 · 백오프)는 `core-notification` 의 `OutboxService`
- [maintenance/job-run.store.ts](../../backend/src/maintenance/job-run.store.ts) — `start`(유니크 충돌 = 실행 중 → 건너뜀) · `finish`(CAS) · `findExpired`
- `app.module.ts` 의 `JobsModule.forRoot({ store: PrismaJobRunStore, timeZone: 'Asia/Seoul' })`, 작업은 `maintenance/*` 의 `@Job({ name, cron, leaseMs })`
- 마이그레이션 `20260919214231_add_job_run` · `20260919224427_add_outbox_message`, `/_meta` 의 작업 · 아웃박스 적체 구역(`meta/`)

## 지금 검토 — 대안 비교 *(AI 초안 · 본인이 읽고 고친다)*

알림 푸시:

| 대안 | 장점 | 단점 | 이 프로젝트에 대입하면 |
| --- | --- | --- | --- |
| 커밋 뒤 바로 발송 (afterCommit 훅 · 트랜잭션 다음 줄) | 테이블이 없다. 단순 | 커밋 직후 프로세스가 죽으면 사라진다. 재시도 · 실패 기록을 따로 만들어야 한다 | 알림 하나 놓쳐도 큰일은 아니지만, 결제일 · 만기 알림이 이 앱의 핵심 기능이다 |
| 메시지 큐 (Redis + BullMQ 등) | 재시도 · 지연 · 동시성 기능이 다 있다 | 인프라가 하나 는다. DB 커밋과 큐 적재가 원자적이지 않아 결국 아웃박스가 또 필요하다 | 1인 홈서버에 Redis 를 늘리는 운영 부담이 크다 |
| **지금**: DB 아웃박스 + 폴링 + CAS 선점 | 커밋과 적재가 원자적이다. 추가 인프라가 없다 | 폴링 지연 · DB 부하. at-least-once 라 같은 푸시가 두 번 갈 수 있다 | 하루 알림이 몇십 건이라 부하는 문제 되지 않는다 |

예약 작업:

| 대안 | 장점 | 단점 | 이 프로젝트에 대입하면 |
| --- | --- | --- | --- |
| `@nestjs/schedule` 그대로 (09-20 이전) | 가장 단순 | 실행 기록 · 겹침 · 멈춤 처리가 없다. "며칠째 안 돈 작업" 을 알 수 없다 | 실제로 순자산 스냅샷 이름표가 한 달 밀린 것을 `job_run` 기록으로 확인했다 (`8b0c4e4`) |
| DB 잠금 (`GET_LOCK` · `SELECT … FOR UPDATE`) | 유니크 키 · lease 없이 겹침을 막는다. 연결이 끊기면 잠금이 풀린다 | 실행 기록이 따로 필요하다. 긴 작업 동안 연결을 잡고 있다 | 겹침 방지만 보면 더 단순하다 |
| 호스트 cron + CLI 명령 | 앱 프로세스와 분리 | 배포 단위가 늘고 설정이 레포 밖에 생긴다 | 데모 초기화는 이 방식(호스트 crontab)이다 ([0008](0008-separate-demo-instance.md)) |

- **지금 보니 맞는 점 (초안)**
  - "알림은 저장됐는데 푸시가 안 갔다 / 롤백됐는데 푸시는 갔다" 가 구조로 막힌다.
  - 실행 기록이 남아서, 장애 분석을 기억이 아니라 `job_run` 행으로 했다 (스냅샷 이름표 보정 근거).
  - 늦게 끝난 실행이 이미 마감된 기록을 덮지 않는다.
- **아쉬운 점 · 위험 (초안)**
  - backend 프로세스는 하나다. "프로세스 사이" 겹침은 배포 때 옛 · 새 컨테이너가 잠깐 같이 뜰 때뿐인데, compose 교체 방식에서 실제로 겹치는지는 확인하지 않았다 (확인 필요).
  - "한 기기라도 성공하면 성공" 이라, 기기 세 대 중 하나만 실패하면 그 기기는 다시 보내지 않는다.
  - `claim` 은 후보 조회 뒤 행마다 UPDATE 한다(N+1). 지금 규모에선 문제 없다.
  - 같은 레포의 refresh 토큰 회전은 CAS 를 쓰지 않는다 ([0001](0001-jwt-access-refresh-rotation.md)).

## 다시 정한다면 — 본인 작성

> *비어 있음.* 위 비교를 읽고 같은 선택인지, 바꾼다면 무엇을 왜 바꾸는지 한 줄.
> 생각할 질문:
>
> - 프로세스가 하나뿐인데 DB 로 겹침을 막을 필요가 있었나? 없었다면 무엇을 덜어 낼 수 있나?
> - at-least-once 와 at-most-once 중 이 앱의 알림에는 무엇이 맞나? 메일이라면?
> - 아웃박스 행은 언제 지워야 하나? 지금 90일은 무엇을 근거로 한 값인가?

## 참고

- [core-libraries.md](../core-libraries.md) §2 · §3
- [architecture.md](../architecture.md) 「크론 스케줄러」
- [README](../../README.md) 「해결한 문제 2 · 3」
