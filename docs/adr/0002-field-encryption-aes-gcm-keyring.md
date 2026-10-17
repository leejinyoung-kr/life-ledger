# 0002. 민감 필드는 앱에서 AES-256-GCM 으로 암호화 — 키링 · 필드/사용자 AAD · 부팅 시 재암호화

- **상태**: 채택 (소급 기록)
- **결정일**: 2026-06-05 (근거 커밋 `64d4011`) · 키링 · AAD 는 2026-09-19 (`980b2e7`)
- **기록일**: 2026-10-18
- **결정 방식**: AI 제안을 그대로 채택 — 당시 대안 검토는 없었다

## 맥락

- 계정 보관함에 사이트 비밀번호 · TOTP 시크릿 · 백업 코드를, 투자 계좌에 계좌번호를 저장한다. 지운 기능(ENV 값 · 신원 번호 · OpenAI 키, 2026-10-13 제거)도 같은 방식이었다.
- 이 값들을 DB 에 어떤 형태로 둘지 정해야 했다.

## 당시 결정

첫 커밋 `64d4011` 은 "CryptoService(AES-256-GCM, CREDENTIAL_SECRET 키)" 라고만 적었다. **AES-256-GCM 을 고른 이유, DB 암호화가 아니라 앱에서 암호화한 이유는 기록에 없다.** 처음 형식은 지금 `v1` 이라 부르는 것으로, 키 = SHA-256(시크릿) · AAD 없음이다 (young-core `spec/crypto.md`, 비공개).

| 날짜 | 커밋 | 바뀐 것 |
| --- | --- | --- |
| 06-05 | `64d4011` | AES-256-GCM, 키 하나(`CREDENTIAL_SECRET`). 목록 응답에는 원문을 싣지 않고 `reveal` 로만 연다 |
| 06-05 | `b1eadbc` | 왕복 · 변조 탐지 · 키 미설정 단위 테스트 |
| 06-16 | `1cde382` | 부팅 시 시크릿 검증(미설정 · 32자 미만 · 예시값 거부) |
| 07-17 | `ec49a92` | 코어 `core-security` 로 옮김 |
| 09-19 | `980b2e7` | 키링 `CRYPTO_KEYS` · AAD(`필드:사용자id`) · 부팅 시 재암호화(raw SQL compare-and-swap) · 배포 전 전체 복호화 점검 |
| 09-20 | `b0ce553` | 암호문 컬럼에 평문을 쓰면 막는 Prisma 쓰기 가드 |

당시 기록(AI 작성)에 남은 이유:

- "읽을 때 자동 복호화는 하지 않는다 — 열람은 마스터잠금·감사 로그·레이트리밋을 거치는 명시적 행위로 남긴다(자동 복호화면 목록 조회에도 평문이 실린다)." — `b0ce553`
- "자동 암호화도 하지 않는다. 문맥(AAD)에는 필드와 소유자가 필요한데, 그걸 아는 건 호출부뿐이다." — [core-libraries.md](../core-libraries.md) §1
- "재암호화는 하지 않는다 — 기존 컨테이너가 새 포맷을 못 읽을 수 있어서, 새 컨테이너가 부팅하며 한다" — [deploy-home-server.yml](../../.github/workflows/deploy-home-server.yml) 주석
- "처음엔 키 하나로 암호화만 했는데, 그러면 키를 바꿀 수 없고 다른 행의 암호문을 옮겨 붙여도 풀린다." — [README](../../README.md) 「해결한 문제 1」. 2026-10-15 공개 때 쓴 **사후 설명**이다.

## 지금 코드에 남은 것

- [backend/src/crypto/crypto-fields.ts](../../backend/src/crypto/crypto-fields.ts) — `ENCRYPTED_COLUMNS`, `cipherContext(필드, 사용자 id)`. `crypto-fields.spec.ts` 가 schema.prisma 와 목록을 대조한다
- `backend/src/crypto/` — `cipher-store.ts`(CAS UPDATE) · `crypto-audit.service.ts` · `crypto-bootstrap.service.ts`(부팅 점검 · 재암호화) · `crypto-check.ts`(배포 전 점검)
- [backend/src/prisma/prisma.service.ts](../../backend/src/prisma/prisma.service.ts) — `encryptedFields` 쓰기 가드
- [backend/src/config/env.ts](../../backend/src/config/env.ts) — `CRYPTO_KEYS`(`<키ID>:<시크릿>` 목록, 첫 번째가 현재 키), `CREDENTIAL_SECRET`(v1 읽기 전용)
- 배포 워크플로 — `check-env` → `migrate deploy` → `crypto-check` → `up -d` → healthy 뒤 `crypto-check` 한 번 더
- 마스터 잠금 비밀번호는 암호화가 아니라 scrypt 해시 ([architecture.md](../architecture.md) Stack 표)

## 지금 검토 — 대안 비교 *(AI 초안 · 본인이 읽고 고친다)*

| 대안 | 장점 | 단점 | 이 프로젝트에 대입하면 |
| --- | --- | --- | --- |
| DB 수준 암호화 (MariaDB 저장소 암호화) | 앱 코드가 그대로다 | 디스크 · 파일 도난만 막는다. DB 사용자로 읽으면 평문이다 | 매일 `mariadb-dump` 덤프(`db_backups` 볼륨)는 평문 SQL 이라, 덤프가 새는 경우를 못 막는다 |
| 외부 KMS · 봉투 암호화 (AWS KMS, Vault) | 키가 앱 서버 밖에 있다. 접근 기록 · 회전 관리 | 외부 의존 · 비용. 홈서버가 클라우드에 기대게 된다 | 1인 홈서버에 운영 부담이 크다. 다만 "키와 DB 가 같은 서버" 라는 약점은 이것만 없앤다 |
| XChaCha20-Poly1305 (libsodium) | nonce 가 192bit 라 랜덤 nonce 충돌 걱정이 없다 | Node 기본 `crypto` 에 없어 의존성이 는다 | 같은 개발자의 safe-box 는 이쪽을 썼다. 이 앱의 암호문은 수십 건이라 GCM 96bit 랜덤 IV 충돌은 현실적인 위험이 아니다 |

- **지금 보니 맞는 점 (초안)**
  - AAD 로 "다른 행 · 다른 사용자에 옮겨 붙인 암호문" 이 풀리지 않는다.
  - 배포 전 전체 복호화 점검이 "키를 빼먹고 배포" 사고를 컨테이너 교체 전에 멈춘다.
  - 읽기 자동 복호화가 없어서, 평문은 잠금 · 감사 로그를 거친 열람에만 나온다.
- **아쉬운 점 · 위험 (초안)**
  - 키(`backend/.env`)와 DB 가 같은 홈서버에 있다. 막는 것은 "DB 덤프 · DB 계정만 샌 경우" 다. 이 위협 모델을 적어 둔 문서가 없다.
  - 키를 잃으면 복구할 수 없다. 키 보관 규칙은 CLAUDE.md 의 "서버 밖에도 보관" 한 줄뿐이다.
  - 처음 3개월 반(06-05 ~ 09-19)은 키 교체 · AAD 가 없었다. v1 은 키 유도 없이 SHA-256(시크릿)이다 — 지금은 읽기 전용.
  - 쓰기 가드는 중첩 쓰기와 raw 쿼리를 거치지 않는다 ([core-libraries.md](../core-libraries.md) §1 "한계").

## 다시 정한다면 — 본인 작성

> *비어 있음.* 위 비교를 읽고 같은 선택인지, 바꾼다면 무엇을 왜 바꾸는지 한 줄.
> 생각할 질문:
>
> - 이 암호화가 막는 위협은 정확히 무엇인가 — 덤프 유출? 서버 탈취?
> - 키를 어디에 둬야 "DB 와 같이 털리지" 않나? 1인 홈서버에서 할 수 있는 현실적인 방법은?
> - GCM 에서 같은 키로 IV 가 겹치면 무엇이 깨지나?

## 면접 예상 질문

- AES-GCM 을 고른 이유는? IV 를 재사용하면 어떻게 되나?
- AAD 는 무엇이고 여기서는 무엇을 막나?
- 서비스를 멈추지 않고 키를 바꾸는 순서는? 재암호화 중 사용자가 같은 행을 고치면?
- 테스트 벡터를 왜 두나? 왜 "복호 방향" 으로만 두나?
- 키가 DB 와 같은 서버에 있으면 암호화가 의미가 있나?

## 참고

- [core-libraries.md](../core-libraries.md) §1 — 암호문 형식 · 키링 · 쓰기 가드
- [CLAUDE.md](../../CLAUDE.md) 「보관함 암호화」 — 키 교체 절차
- young-core `spec/crypto.md` · `spec/vectors/crypto.json` (비공개 레포)
- [0003](0003-home-server-self-hosted-runner.md) — 배포 단계의 `crypto-check`
