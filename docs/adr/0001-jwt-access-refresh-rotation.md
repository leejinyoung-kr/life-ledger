# 0001. 로그인 유지는 서버 세션 대신 JWT — access 15분 + refresh 회전 · 폐기

- **상태**: 채택 (소급 기록)
- **결정일**: 2026-06-01 (근거 커밋 `c55f14c`)
- **기록일**: 2026-10-18
- **결정 방식**: AI 제안을 그대로 채택 — 당시 대안 검토는 없었다

## 맥락

- 사용자는 1명이다. 로그인은 Google OAuth(2026-06-01)와 이메일 인증코드(2026-06-15 `2bcc86d`) 두 가지이고, 허용 목록(`ALLOWED_EMAILS`, 2026-06-08 `af1eaaf`) 밖은 거부한다.
- 브라우저(PC · 휴대폰 PWA)가 API 를 부른다. 로그인 상태를 무엇으로 유지할지 정해야 했다.

## 당시 결정

첫 커밋 `c55f14c` 은 "Google OAuth 2.0 + JWT 인증 모듈 추가" 라고만 적었다. **세션 대신 JWT 를 고른 이유는 기록에 남은 것이 없다.**

그 뒤 모양이 여러 번 바뀌었다.

| 날짜 | 커밋 | 바뀐 것 |
| --- | --- | --- |
| 06-01 | `c55f14c` | JWT 발급 시작 |
| 06-05 | `70878ff` | access(15분, Bearer) + refresh(7일, httpOnly 쿠키)로 나눔. 쿠키는 "dev Lax / prod None;Secure". "스키마 변경 없음(stateless refresh)" |
| 06-10 | `e138f73` | refresh 화이트리스트(`RefreshToken`, jti) · 회전 · 로그아웃/세션 차단 때 폐기. access 를 localStorage 대신 메모리에 |
| 07-17 | `73e2b5f` | 전략 · 가드 · 데코레이터를 코어 `core-auth` 로 옮김 |
| 09-18 | `f9dcdfd` | 토큰 `type` 검사 — refresh · 보관함 토큰이 access 로 통과하던 것을 막음 |
| 09-19 | `24ebc80` | 용도별 시크릿 3개 분리, access `iss`/`aud` 검증, HS256 고정 |
| 10-09 | `487811a` | refresh 쿠키를 `SameSite=Lax` 로 (CSRF) |
| 10-09 | `f19de49` · `b46bce5` | 쿠키 이름 앱 접두사, `email_verified` 확인 · OAuth `state` 쿠키 |

당시 기록(AI 작성)에 남은 이유는 세부 설정에 대한 것뿐이다.

- "Access 짧게(자주 갱신), Refresh 는 설정(session_expiry)에 따라 가변" — `backend/src/auth/auth.service.ts` 주석
- "refresh 전용 시크릿 — access 와 분리해 refresh 토큰이 보호 API 에서 절대 검증되지 않게 한다" — `auth.service.ts` 주석
- "외부 사이트에서 /auth/refresh·/logout 을 부르는 CSRF 는 막힌다" — `auth.controller.ts` 주석 · `487811a`
- "시크릿을 실수로 공유해도 다른 앱 토큰이 통과하지 않는다" (`iss`/`aud` 고정) — young-core `spec/auth.md` (비공개)

## 지금 코드에 남은 것

- [backend/src/auth/auth.service.ts](../../backend/src/auth/auth.service.ts) — `ACCESS_TTL = '15m'`, refresh 수명은 사용자 설정 `session_expiry`(12h · 1d · 7d · `none` = 3650일), `issueTokens` · `refresh`(회전) · `logout`(jti 폐기)
- [backend/src/auth/auth.controller.ts](../../backend/src/auth/auth.controller.ts) — `ll_refresh_token`(httpOnly · `SameSite=Lax` · 운영 `Secure` · `path=/`), JS 가 읽는 힌트 쿠키 `ll_has_session`
- [backend/src/auth/jwt.constants.ts](../../backend/src/auth/jwt.constants.ts) — `iss`/`aud` = `life-ledger`
- [backend/src/config/env.ts](../../backend/src/config/env.ts) — `JWT_SECRET` · `JWT_REFRESH_SECRET` · `JWT_VAULT_SECRET` 32자 이상, 서로 달라야 부팅
- `backend/prisma/schema.prisma` — `RefreshToken`(jti · `session_id` · `revoked_at`), `LoginSession`
- [frontend/lib/api.ts](../../frontend/lib/api.ts) — access 는 모듈 변수(메모리), 401 이면 `/auth/refresh` 한 번 → 재요청, 새로고침은 `ensureSession`

## 지금 검토 — 대안 비교 *(AI 초안 · 본인이 읽고 고친다)*

| 대안 | 장점 | 단점 | 이 프로젝트에 대입하면 |
| --- | --- | --- | --- |
| 서버 세션 + 세션 쿠키 (DB 저장) | 끊으면 즉시 끊긴다. 부품이 적다 | 요청마다 저장소 조회. 쿠키 인증이라 CSRF 대책이 모든 쓰기 요청에 필요 | 사용자 1명 · 서버 1대라 조회 부담은 없다. 이미 `login_session` · `refresh_token` 테이블이 있어 서버 상태를 갖고 있다 |
| **지금**: access JWT(Bearer, 메모리) + refresh(httpOnly 쿠키, DB 화이트리스트, 회전) | access 검증에 DB 조회가 없다. access 가 쿠키가 아니라 CSRF 대상이 refresh · logout 둘로 줄어든다. 기기별로 끊을 수 있다 | 부품이 많다(시크릿 3개 · `type` · `iss`/`aud` · 회전 · 쿠키 속성). 실제로 `type` 미검사(09-18) · `SameSite=None`(10-09)에서 구멍이 났다. 세션을 끊어도 access 는 최대 15분 산다 | 보안 이벤트(새 기기 알림 · 세션 차단)는 있지만 15분 공백이 문제 될 만한 규모는 아니다 |
| 긴 access JWT 하나 (localStorage) | 가장 단순 | 탈취되면 만료까지 못 끊는다. XSS 로 바로 읽힌다 | 계정 비밀번호를 담는 앱이라 맞지 않는다 |

- **지금 보니 맞는 점 (초안)**
  - 보관함 잠금 해제를 별도 토큰(`JWT_VAULT_SECRET`, `type: 'vault'`)으로 두는 구조와 같은 틀이다.
  - refresh 는 httpOnly 라 XSS 로 읽히지 않고, access 는 메모리에만 있어 새로고침하면 사라진다.
- **아쉬운 점 · 위험 (초안)**
  - refresh 를 DB 에서 조회하므로 "stateless" 는 access 에만 맞는 말이다. 이 규모에선 서버 세션이 더 단순했을 수 있다.
  - 회전이 compare-and-swap 이 아니다. `refresh()` 가 `findUnique` 로 `revoked_at` 을 본 뒤 `update({ where: { id } })` 로 폐기한다 — 같은 토큰으로 동시에 두 번 부르면 둘 다 새 토큰을 받을 수 있다 (코드 읽고 확인 필요). 같은 레포의 아웃박스 · `job_run` 은 CAS 를 쓴다 ([0007](0007-transactional-outbox-and-job-run-cas.md)).
  - 이미 폐기된 jti 가 다시 들어와도(재사용) 그 세션을 통째로 끊지 않는다 — 탈취 감지가 없다.
  - 탭 두 개가 동시에 refresh 하면 늦은 쪽이 폐기된 쿠키를 보내 로그아웃될 수 있다. `70878ff` 의 "동시 refresh 중복 방지" 는 한 탭 안에서만이다 (확인 필요).
  - `session_expiry = none` 이면 refresh 가 10년 산다.

## 다시 정한다면 — 본인 작성

> *비어 있음.* 위 비교를 읽고 같은 선택인지, 바꾼다면 무엇을 왜 바꾸는지 한 줄.
> 생각할 질문:
>
> - 사용자 1명 · 서버 1대에서 "DB 조회 없는 access 검증" 이 실제로 얻는 게 있나?
> - 세션을 끊었는데 access 가 15분 살아 있는 것을 받아들일 수 있나?
> - refresh 회전을 조건부 UPDATE(CAS)로 바꾸고 재사용 감지를 넣을까?

## 면접 예상 질문

- 세션 대신 JWT 를 쓴 이유는? refresh 를 DB 에 저장하면 결국 세션과 무엇이 다른가?
- refresh 토큰을 왜 회전하나? 회전만으로 탈취를 막을 수 있나?
- `SameSite` Lax · Strict · None 의 차이와, 이 앱에서 None 이 왜 문제였나?
- access 를 localStorage 가 아니라 메모리에 두는 이유와 새로고침은 어떻게 처리하나?
- 로그아웃한 기기의 access 토큰은 언제까지 유효한가?

## 참고

- [api.md](../api.md) 인증 절 · [core-libraries.md](../core-libraries.md) `core-auth`
- 커밋 `70878ff` · `e138f73` · `f9dcdfd` · `24ebc80` · `487811a`
- [0007](0007-transactional-outbox-and-job-run-cas.md) — compare-and-swap 을 쓰는 곳
