# 공통 라이브러리 (young-core) 요약

LifeLedger 백엔드는 공통 기능을 개인 공통 라이브러리 young-core(`@leejinyoung-kr/core-*`, **비공개 레포**)에서 가져다 쓴다.
여러 개인 프로젝트(Node · Java)가 같이 쓰는 코드라 이 레포에는 쓰는 쪽(어댑터 · 저장소)만 있다. 이 문서는 레포 밖에 있는 쪽의 설계와 핵심 코드를 요약한다.

| 패키지 | 하는 일 | 이 레포에서 쓰는 곳 |
| --- | --- | --- |
| core-security | AES-256-GCM 암복호화(키링 · AAD · 키 교체), 암호문 컬럼 쓰기 가드 | [backend/src/crypto/](../backend/src/crypto/), [prisma.service.ts](../backend/src/prisma/prisma.service.ts) |
| core-jobs | 예약 작업 `@Job` — 실행 기록 · 겹침 방지 · lease 마감 | [backend/src/maintenance/](../backend/src/maintenance/) |
| core-notification | SMTP 메일, Web Push, 트랜잭션 아웃박스 | [backend/src/push/](../backend/src/push/), [notification.service.ts](../backend/src/notification/notification.service.ts) |
| core-auth | JWT · Google · 로컬 전략, 전역 가드, 데코레이터 | [backend/src/auth/](../backend/src/auth/) |
| core-storage | S3 호환(B2) 업로드 · 삭제 · presigned, MIME/매직바이트 검증 | [backend/src/file/](../backend/src/file/) |
| core-config | 부팅 시 환경 변수 스키마 검증 — 틀린 키를 전부 모아 한 번에 보고 | [backend/src/config/env.ts](../backend/src/config/env.ts) |
| core-common · core-logging | 전역 예외 필터 · 페이지네이션 · `/_meta`, 요청 ID · 접근 로그 | 컨트롤러 전반 |

아래 코드는 라이브러리에서 발췌해 줄였다(검증 · 로그 일부 생략).

## 1. 암호화 — core-security

### 암호문 형식

```text
v2:<키ID>:<iv>:<tag>:<cipher>          (hex, iv 12바이트 랜덤 · tag 16바이트)

키  = HKDF-SHA256(시크릿, salt = 고정 상수, info = "v2:" + 키ID)   → 키 ID 마다 다른 AES 키
AAD = "v2:" + 키ID + ":" + context                               → 키 ID 까지 인증에 묶는다
```

- **키링**: 설정은 키 목록 + 현재 키 ID. 암호화는 항상 현재 키로, 복호화는 암호문 머리의 키 ID 로 키를 고른다 — 그래서 키를 바꿔도 옛 암호문이 읽힌다.
- **문맥(AAD) 필수**: 빈 문맥은 암 · 복호화 모두 거부한다. LifeLedger 는 `필드:사용자ID`(예: `credential.password_enc:42`)를 넣는다 — [cipherContext](../backend/src/crypto/crypto-fields.ts). 다른 행 · 다른 사용자로 옮긴 암호문은 GCM 인증이 깨져 풀리지 않는다.
- **부팅에서 거부**: 키 0개 · ID 형식 오류 · 중복 · 시크릿 32자 미만 · 두 키가 같은 시크릿 · 현재 키가 목록에 없음 → 틀린 항목을 전부 모아 한 번에 보고하고 부팅을 멈춘다(시크릿 값은 메시지에 넣지 않는다).
- **형식 고정**: 언어 무관 명세와 테스트 벡터(옛 버전이 만든 실제 암호문)로 형식을 고정했다. Java 구현도 같은 벡터를 통과해야 해서 두 언어가 같은 암호문을 읽고 쓴다.

```ts
encrypt(plain: string, context: string): string {
  requireContext(context);
  const iv = randomBytes(12); // GCM 권장 96bit
  const cipher = createCipheriv('aes-256-gcm', this.currentKey, iv);
  cipher.setAAD(aad(this.currentKeyId, context));
  const body = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return ['v2', this.currentKeyId, iv.toString('hex'), cipher.getAuthTag().toString('hex'), body.toString('hex')].join(':');
}

decrypt(payload: string, context: string): string {
  requireContext(context);
  const header = readCipherHeader(payload);            // 형식이 아니면 거부
  const key = this.keys.get(header.keyId);             // 설정에 없는 키면 거부
  return open(key, payload.split(':').slice(2), aad(header.keyId, context));
  // 인증 실패(키 · 문맥 불일치, 변조)는 원인을 구분하지 않고 같은 오류로 낸다
}

// 키 교체용 — 다시 암호화한 결과를 한 번 더 풀어 원문과 같은지 확인한 뒤 돌려준다
reencrypt(payload: string, context: string): string {
  const plain = this.decrypt(payload, context);
  const next = this.encrypt(plain, context);
  if (this.decrypt(next, context) !== plain) throw new Error('재암호화 검증 실패');
  return next;
}
```

LifeLedger 쪽에서 이 위에 얹은 것: 부팅 시 전체 점검 · 재암호화(compare-and-swap UPDATE — [cipher-store.ts](../backend/src/crypto/cipher-store.ts), [crypto-audit.service.ts](../backend/src/crypto/crypto-audit.service.ts)), 배포 전 전체 복호화 점검([crypto-check.ts](../backend/src/crypto/crypto-check.ts)).

### 암호문 컬럼 쓰기 가드

Prisma 클라이언트 확장. 쓰기 연산(`create` · `update` · `upsert` 등)에서 암호문 컬럼 값이 위 형식이 아니면 막는다. 오류 메시지에 값은 넣지 않는다(값이 곧 비밀이다).

```ts
prisma.$extends(encryptedFields({ credential: ['password_enc', 'totp_enc', 'backup_codes_enc'], investmentAccount: ['account_number_enc'] }));
```

- 읽을 때 자동 복호화는 일부러 하지 않는다. 자동이면 목록 조회에도 평문이 실린다 — 열람은 마스터 잠금 · 감사 로그 · 레이트 리밋을 거치는 명시적 동작으로 남긴다.
- 자동 암호화도 하지 않는다. 문맥(AAD)에는 필드와 소유자가 필요한데, 그걸 아는 건 호출부뿐이다.
- 한계: 중첩 쓰기와 raw 쿼리는 확장을 거치지 않는다(재암호화의 raw UPDATE 는 일부러 통과시킨다).

## 2. 예약 작업 — core-jobs

`@Job({ name, cron, leaseMs })` 을 붙이면 실행마다 기록을 남기고, 겹침 · 멈춤을 처리한다. 저장소는 앱이 구현한다 — LifeLedger 는 `job_run` 테이블([job-run.store.ts](../backend/src/maintenance/job-run.store.ts)).

- **겹침 방지 두 겹**: 같은 프로세스 안은 메모리의 실행 자리로, 프로세스 사이는 저장소가 막는다(LifeLedger 는 `running_key` 유니크 — 충돌하면 건너뜀).
- **lease**: 핸들러와 lease 타이머를 경주시켜 먼저 끝나는 쪽을 따른다. lease 가 먼저 끝나면 실패로 마감하고 핸들러에 중단 신호(`AbortSignal`)를 보낸다 — 멈춘 작업이 다음 실행을 막지 않는다.
- **죽은 실행 마감**: 배포 · 장애로 프로세스가 죽어 `running` 으로 남은 기록은 다음 실행 때 lease 가 지났으면 실패(`lease_expired`)로 마감한다.
- **기록 없이는 실행하지 않는다**: 시작 기록에 실패하면 건너뛴다 — 기록 없이 돌면 겹침 방지와 lease 마감이 둘 다 깨진다.

```ts
async run(def: JobDefinition, trigger: JobTrigger): Promise<JobRunOutcome> {
  if (this.active.has(def.name)) return this.skip(def, '이 프로세스에서 이미 실행 중');
  this.active.set(def.name, slot);                  // await 전에 자리를 잡는다

  await this.expireLeases();                        // 죽은 실행부터 마감
  const runId = await this.store.start({ job: def.name, trigger, startedAt, leaseUntil });
  if (runId === null) return this.skip(def, '다른 실행이 아직 lease 를 잡고 있음');

  const settled = settle(def, ctx);                 // 핸들러 실행(예외도 값으로)
  const result = await Promise.race([settled, leaseTimer]);
  this.release(def.name, slot);                     // lease 가 끝난 실행이 다음 실행을 막지 않게 먼저 비운다

  if (result === null) {                            // lease 만료
    controller.abort(new JobLeaseExpiredError(def.name, def.leaseMs));
    await this.close(def, runId, startedAt, { status: 'failed', error: 'lease_expired: …' });
    return { status: 'failed', runId, error };
  }
  await this.close(def, runId, startedAt, result);  // 성공/실패 + 요약 · 원본 에러 기록
  return result;
}
```

## 3. 트랜잭션 아웃박스 — core-notification

알림 행을 만드는 트랜잭션 안에서 발송할 메시지를 `outbox_message` 에 같이 적재한다. 롤백되면 메시지도 사라지니 "저장은 롤백됐는데 푸시는 나간" 상황이 구조적으로 생기지 않는다.

```ts
await prisma.$transaction(async (tx) => {
  const row = await tx.notification.create({ ... });
  await outbox.enqueue(tx, { channel: 'webpush', payload, idempotencyKey: `noti:${row.id}` });
});
outbox.flush(); // 커밋 뒤 바로 발송을 시도한다(기다리지 않는다)
```

- **보장은 at-least-once**: 발송에 성공했지만 기록 전에 프로세스가 죽으면 한 번 더 보낸다. 같은 내용이 두 번 가는 것보다 안 가는 게 나쁜 알림이라 이쪽을 골랐다.
- **멱등 키**: 시간 창이 아니라 도메인 식별자(`noti:1234`)로 중복 적재를 막는다(LifeLedger 는 유니크 키 충돌이면 이미 적재된 것으로 본다).
- **선점(claim)**: 발송할 묶음을 선점 시각과 함께 compare-and-swap 으로 잡는다. 발송 중 죽으면 선점 시간이 지난 뒤 다시 대상이 된다 — [outbox.store.ts](../backend/src/push/outbox.store.ts).
- **재시도**: 지수 백오프(상한 있음), 최대 횟수를 넘거나 영구 오류(`OutboxPermanentError`)면 마감. 마감할 때 마감 사유로 덮어쓰지 않고 **원본 에러를 그대로** 남긴다 — LifeLedger 는 마지막 실패를 시스템 로그(`/logs`)에도 남긴다.
- 발송은 순차로 한다 — 외부 발송처(SMTP · 푸시 서버)에 한꺼번에 몰리지 않게.

```ts
private async deliver(message: OutboxPending): Promise<'sent' | 'failed' | 'retry'> {
  const channel = this.channels.get(message.channel);
  if (!channel) return this.fail(message, new OutboxPermanentError(`등록되지 않은 채널 '${message.channel}'`));
  try {
    await channel.send(message.payload);
  } catch (e) {
    return this.fail(message, e);       // 시도 횟수 + 1, 다음 시각 = 지수 백오프 또는 마감
  }
  try {
    await this.store.markSent(message.id, new Date());
  } catch (e) {
    // 발송은 됐는데 기록을 못 남겼다 → 선점이 풀리면 한 번 더 간다(at-least-once)
  }
  return 'sent';
}
```
