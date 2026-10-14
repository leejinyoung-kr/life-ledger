# 공개 준비 계획 (포트폴리오용)

> 작성 2026-10-13. 회사 지원 때 개인 프로젝트로 내기 위해 doc-nexus 를 공개용으로 다듬는다.
> 끝나면 `docs/archive/` 로 옮긴다.

## 목표

- 면접관이 **사이트에 바로 들어가 둘러보고**(데모 계정), **GitHub 를 브라우저로 훑어보는** 상황에 맞춘다. 클론·실행까지는 가정하지 않는다.
- 실제로 쓰는 기능만 남기고, 이름·디자인을 지금 용도에 맞게 바꾼다.
- 운영 데이터(실제 계정·자산)는 데모와 완전히 분리한다.

## 정해진 것 (2026-10-13)

| 항목 | 결정 |
| --- | --- |
| 뺄 화면 | ENV 보관함 (safe-box 로 옮김) · 신원 지갑 · 파일 변환 · AI 리포트 |
| 보안 센터 | '보안' 화면 하나로 줄인다 — 로그인 기기/세션 + 마스터 잠금 켜기/끄기 · 세션 만료 · 비밀번호 자동 숨김(설정 보안 탭에서 옮김) + 최근 열람 기록 |
| 설정 | 프로필 · 데이터 탭만 남긴다. 보안 탭(→ 보안 화면으로) · API 키 탭 · 위젯 설정 탭 삭제 |
| 마스터 잠금 | 유지 — 계정 보관함 열람 · 백업 · 계정 삭제가 이 잠금을 쓴다. 지금은 설정하지 않은 상태 |
| 사이드바 메뉴 순서 편집 | 삭제 — 순서 고정 (`menu_order` 컬럼도 정리) |
| 대시보드 | 남기고 같이 정리한다 — 위젯 켜기/끄기 대신 고정 레이아웃, AI 요약 · 신원 만료 제거 |
| 파일 보관함 | 유지 (사용 중) |
| 남는 화면 (12) | 대시보드 · 자산 관리 · 구독 관리 · 자산 종합 · 계정 보관함 · 파일 보관함 · 캘린더 · 보안 · 알림 · 시스템 로그 · 코드 관리 · 설정 |
| 데모 | 운영 인스턴스에 더미 계정을 넣지 않고, 별도 인스턴스로 띄운다 |
| young-core | 공개한다 (암호화 · 인증 핵심 코드가 거기 있다). npmjs 배포는 하지 않는다 |
| 이름 | **`life-ledger`** (생활 장부) |
| 공개 방식 | **이 레포를 그대로 공개** — 아래 |
| 디자인 | 다른 프로젝트처럼 기획서(`docs/planning.md`) → Claude 디자인 → 시안을 `docs/design/` 에 둔다 |

### 공개 방식: 이 레포를 그대로 공개 (공개용 레포를 따로 두지 않는다)

- 이유: 앞으로도 계속 고쳐 쓸 앱이라 레포가 둘이면 공개 쪽이 금방 낡는다. 커밋 317개(2026-10-13)는 실제로 운영하며 고쳐 온 기록이라 그 자체로 보여 줄 거리다.
- 이력: `.env` · 키 파일이 커밋된 적은 없다 (파일 이름 기준 확인, 2026-10-13). 공개 직전에 gitleaks 로 전체 이력 내용을 검사한다.
- self-hosted runner 조건 — 공개 레포는 누구나 fork 해서 PR 을 열 수 있고, PR 의 워크플로는 PR 쪽 파일로 돈다:
  - 레포 설정 Actions → "Fork pull request workflows" 를 **모든 외부 기여자 승인 필요**로 둔다 (공개 전에 먼저).
  - 배포 워크플로는 지금처럼 `push`(main) · `workflow_dispatch` 에서만 돈다. `pull_request` 트리거를 넣지 않는다.
- 커밋 작성자 이메일이 공개된다 — 지난 커밋 이메일이 무엇인지 공개 전에 확인한다.

## 단계

### 0. 준비

- 태그 `before-public` — 지우는 기능(AI 리포트 등)을 나중에 다시 꺼내 볼 수 있게.
- 운영 DB 덤프 → 홈서버 `~/backups/2026-10-xx/` (지울 테이블이 있으므로).
- 지우기 전 데이터 확인 (HeidiSQL, `docnexus`):

  ```sql
  -- ENV 는 safe-box 로 옮겼는지 — 남은 행 수
  SELECT (SELECT COUNT(*) FROM env_project) AS env_projects, (SELECT COUNT(*) FROM env_var) AS env_vars;
  -- 신원 지갑 — 사본 파일이 붙은 행 (기능을 빼면 사본은 잠금 없는 일반 파일로 남는다)
  SELECT id, type, name, file_id, expire_date FROM identity_card;
  -- 지울 enum 값을 쓰는 행
  SELECT action, COUNT(*) FROM access_log WHERE action IN ('env_reveal', 'identity_reveal') GROUP BY action;
  SELECT domain, COUNT(*) FROM category WHERE domain IN ('env_group', 'id_type') GROUP BY domain;
  ```

### 1. 기능 정리

화면 · API · DB 를 같이 지운다. 대상과 엮인 곳은 아래와 같다 (2026-10-13 조사).

| 기능 | 지울 것 | 같이 고칠 곳 |
| --- | --- | --- |
| 파일 변환 | `convert/` (FE · BE), 패키지 `sharp` · `pdf-lib` · `pdf-to-img`, FE `uploadDownload` | 사이드바 |
| ENV 보관함 | `envs/` · `env/`, 모델 `EnvProject` · `EnvVar` · `EnvVarHistory`, enum `EnvKind` | `crypto-fields.ts`(+spec) · 검색 · 백업 ZIP · 휴지통 크론 · access_log `env_reveal` · 코드 관리 `env_group` 탭 · 시드 |
| 신원 지갑 | `id-wallet/` · `identity/`, 모델 `IdentityCard`, enum `IdentityType` | `crypto-fields.ts`(+spec) · 캘린더 가상 일정 · 대시보드 마감 목록 · 만료 알림 크론 · 파일 보관함의 사본 분기(+spec) · 검색 · 백업 · 휴지통 · 코드 관리 `id_type` 탭 · 시드 |
| AI 리포트 | `ai-report/` · `ai/` · `ai-report-cron`, 모델 `AiReport` · `AiUsageLog`, 컬럼 `openai_api_key` · `openai_model` · `notif_monthly`, 패키지 `openai`, 상단 AI 배지 | `crypto-fields.ts`(+spec) · `crypto-audit.service.spec.ts`(테스트 대상 컬럼 교체) · 설정 서비스 · DTO · 백업 omit · 시스템 로그 `ai` 카테고리 · 시드 |
| 보안 센터 축소 | 점수 · 추이 · 위험 요소 · 강도 · 유출 검사 API, `security-snapshot` 크론, 모델 `SecurityRisk` · `SecurityScoreSnapshot` | 계정 삭제 · 백업 · 시드. **vault 라우트 · `VaultService` · `VaultGuard` 는 남긴다** |
| 설정 탭 · 위젯 | API 키 · 위젯 설정 탭, 컬럼 `widgets` · `menu_order` | `settings.defaults.ts` · `vault.service.ts` 의 `DEFAULT_WIDGETS` import(+spec) · 대시보드 `wMap` · 사이드바 `normalizeMenuOrder` |

- enum 값(`AccessAction` · `CategoryDomain`)을 줄이는 마이그레이션은 그 값을 쓰는 행을 먼저 지우는 SQL 을 앞에 넣는다.
- 규모: 화면 16 → 12, 백엔드 모듈 33 → 29, 모델 33 → 25, 예약 작업 11 → 9.
- 문서 갱신: `CLAUDE.md` · `docs/architecture.md` · `docs/erd.md` · `docs/api.md`.

#### 1단계 진행 상황 (2026-10-13, `develop` 브랜치 — 로컬 커밋만, push 전)

기능마다 커밋 하나로 지웠다. 모델 · enum 삭제는 기능 커밋마다 `schema.prisma` 에서 같이 하고(테스트 · 타입체크가 커밋마다 맞도록), 마이그레이션 SQL 은 마지막에 한 번에 만들었다.

| 단계 | 상태 | 비고 |
| --- | --- | --- |
| 파일 변환 제거 | 완료 | `sharp` · `pdf-lib` · `pdf-to-img` 의존성 제거 |
| ENV 보관함 제거 | 완료 | |
| 신원 지갑 제거 | 완료 | 파일 보관함의 사본 분기는 ZIP 잠금 제외 · 비우기 보존 · URL 잠금까지 전부 뺐다. 알림 설정의 '만료·마감 임박' 토글은 보낼 알림이 없어 화면에서 뺐다(`notif_deadline` 컬럼은 남김) |
| AI 리포트 제거 | 완료 | `openai` 의존성 제거. `crypto-audit` 테스트는 credential 컬럼으로 교체 — 평문 레거시(`legacyPlaintext`) 경로는 쓰는 컬럼이 없어졌지만 코드는 남김 |
| 보안 센터 축소 | 완료 | /security = 로그인 기기/세션 · 보안 설정(`SecuritySettings`) · 최근 열람. 설정의 보안 탭 삭제 |
| 설정 위젯 탭 · 메뉴 순서 · 대시보드 고정 | 완료 | 저장된 계정 수 카드는 항상 표시 |
| DB 마이그레이션 | 로컬 적용 완료 | `20261013141800_remove_env_identity_ai_security_score_features` — 앞쪽에 `access_log` · `category` 의 지울 enum 값 행 DELETE 가 들어 있다. 운영은 `main` 배포 때 `migrate deploy` 로 |
| 문서 갱신 | 완료 | `CLAUDE.md` · `architecture.md` · `erd.md` · `api.md` |
| 로컬 화면 확인 | 완료 | 12개 화면 정상, 지운 4개 경로 404. 확인하다 캘린더 일정 수정 기능(백엔드 PUT 은 있고 화면이 없었다)과 시스템 로그 항목 이름 한글 표시를 같이 넣었다 |

실제 규모: 화면 16 → 12, 테이블 33 → 25, 예약 작업 10 → 8(`ai-monthly-report` · `security-snapshot` 삭제).

### 2. 이름 변경

- 범위: GitHub 레포 이름(옛 주소는 자동 리다이렉트), 로컬 · 홈서버 폴더(`~/apps/<새 이름>`), runner 이름, compose 프로젝트 · 컨테이너, 화면 · 메일 · Swagger 제목, PWA(`sw.js`), 백업 파일 접두사, JWT `iss`/`aud`, Tailscale 사이드카 호스트명, 워크스페이스 `CLAUDE.md`.
- 그대로 두는 것: DB 이름 · 사용자 `docnexus`, B2 버킷 — 바꿔도 얻는 게 없고 덤프 · 복원 위험만 있다.
- 영향:
  - 암호문 문맥(AAD)은 `필드:사용자id` 라 앱 이름과 무관하다 — 보관함 데이터는 그대로 풀린다.
  - JWT `iss`/`aud` 가 바뀌면 모든 기기가 한 번 다시 로그인한다.
  - 호스트명이 바뀌면 Google OAuth 리디렉션 URI 를 **사용자가** Google Cloud 콘솔에서 고쳐야 한다. 웹 푸시도 기기마다 다시 구독해야 한다.

#### 2단계 진행 상황 (2026-10-13, `develop` — 코드 쪽 완료)

코드 · 문서에서 바꾼 것:

| 대상 | 바뀐 값 |
| --- | --- |
| 화면 이름 (로고 · 탭 제목 · PWA · 푸시 기본 제목 · 메일 · Swagger · 백업 ZIP 안내) | `DocNexus` → `LifeLedger`, 설명 "자산 · 구독 · 계정을 한곳에서 관리하는 개인 생활 장부" |
| JWT `iss`/`aud` | `doc-nexus` → `life-ledger` (배포하면 모든 기기 다시 로그인) |
| 쿠키 · localStorage 접두사 | `dn_` → `ll_` (`ll_refresh_token` · `ll_has_session` · `ll_recent_search`) |
| 서비스 워커 캐시 | `docnexus-v2` → `life-ledger-v1` (활성화 때 옛 캐시는 지워진다) |
| 백업 ZIP 파일 이름 | `life-ledger-backup.zip` |
| compose 프로젝트 · Tailscale 호스트명 | `life-ledger` · `lifeledger` — **볼륨은 `doc-nexus_db_backups` · `doc-nexus_tailscale_state` 이름 그대로** 이어 쓴다(지난 백업 · 노드 정보를 옮기지 않으려고) |
| 배포 워크플로 클론 경로 | `~/apps/life-ledger` |
| Next 빌드 캐시 id | `nextjs-cache-life-ledger` (첫 빌드 한 번은 캐시 없이) |

그대로 둔 것: DB · 사용자 `docnexus`, B2 버킷, 매일 DB 덤프 파일 접두사 `docnexus_`(DB 이름이라 맞다 — 바꾸면 지난 덤프가 보관 기간 정리에서 빠진다), 테스트 DB 이름.

#### 이름 전환 절차 (`develop` → `main` 배포 때 한 번)

compose 프로젝트 이름이 바뀌어 새 컨테이너(`life-ledger-*`)가 따로 뜬다. 옛 컨테이너(`doc-nexus-*`)가 루프백 3000 · 8000 을 잡고 있으면 `up -d` 가 실패하므로, push 직전에 옛 컨테이너를 내린다 — 빌드 시간(약 4분)만큼 서비스가 멈춘다.

1. GitHub 레포 이름 `doc-nexus` → `life-ledger` (옛 주소는 자동 리다이렉트). 로컬 · 홈서버 클론의 `remote` 주소를 새 이름으로.
2. **사용자**: Google Cloud 콘솔 OAuth 클라이언트에 `https://lifeledger.tailba78c1.ts.net/api/v1/auth/google/callback` 추가(옛 주소는 전환 확인 뒤 삭제).
3. 홈서버:
   - `~/apps/doc-nexus` → `~/apps/life-ledger` 로 옮긴다.
   - 루트 `.env` · `backend/.env` 의 주소(`NEXT_PUBLIC_*` · `FRONTEND_URL` · `CORS_ORIGINS` · `GOOGLE_CALLBACK_URL`)를 `docnexus.tailba78c1` → `lifeledger.tailba78c1` 로 — 값은 출력하지 않고 치환 · 건수만 확인. `SMTP_FROM` 에 이름이 있으면 같이.
   - push 직전 `docker compose -p doc-nexus down` (볼륨은 남는다).
4. `develop` → `main` 머지 · push → 배포 워크플로가 새 경로에서 빌드 · 마이그레이션 · 기동.
5. 확인: `https://lifeledger.tailba78c1.ts.net` 접속 · 로그인 · 보관함 열람(복호화) · `_meta` 의 `warn`. Tailscale 관리 화면에서 노드 이름이 `lifeledger` 로 바뀌었는지(관리 화면에서 이름을 손으로 고친 적이 있으면 안 바뀐다).
6. 기기마다 다시 로그인 · 웹 푸시 다시 켜기.
7. 정리: 러너 폴더 `~/runners/doc-nexus` → `~/runners/life-ledger` (**sudo 필요 — 사용자**, 순서는 infra README "러너 폴더를 옮길 때"), 로컬 폴더 `d:\develop\doc-nexus` → `life-ledger`(VS Code · 개발 서버를 닫고 **사용자**), 워크스페이스 `CLAUDE.md` · infra `README.md`(폴더 목록 · 외부 접속 표) 갱신.

### 3. 보안 화면 개편

- '보안' 화면 하나로: 로그인 기기/세션 · 마스터 잠금 · 세션 만료 · 비밀번호 자동 숨김 · 최근 열람 기록.
- 면접 소재: 비밀번호를 열어 보려면 잠금을 다시 풀어야 하고(`VaultGuard`), 그 열람이 감사 로그로 남는다.
- 최근 열람 목록이 동작 코드를 그대로 보여 준다(`vault` · `vault_disable` · `export:backup` · `data_export` 등) — 한글 이름으로 바꾼다 (2026-10-13 로컬 확인 때 발견).
- 디자인 점검에서 나온 데이터 · 표시 문제를 같이 고친다 — 목록은 `docs/design/life-ledger-review.md` §4.4 · §5. 가장 먼저 **순자산 이중 계산 의심**(현금 = 수입 − 지출 누계가 자산이동을 빼지 않는다)을 확인한다.

#### 3단계 진행 상황 (2026-10-14, `develop` — 로컬 커밋만, push 전)

| 항목 | 결과 |
| --- | --- |
| 순자산 이중 계산 | **맞았다.** 자산이동(연동 대상 있음)은 예적금 잔액 · 투자 예수금에 더해지는데 현금 = 수입 − 지출 이라 같은 돈을 두 번 셌다 → 현금 = 수입 − 지출 − 자산이동(가계부 잔액과 같은 식). `asset.service.spec.ts` 추가 |
| 스냅샷 이름표 | 2026-08-18 부터 매주 월요일에 **지금 값**을 **지난달** 이름으로 덮어써 왔다(그래서 '지난달 대비' 는 사실상 '지난 월요일 대비'). → 매일 01시에 어제가 속한 달 이름으로 저장. 추이 차트의 이번 달 막대는 지금 값(요약 숫자와 같다). 비교할 스냅샷이 없으면 증감 줄을 숨긴다 |
| 운영 스냅샷 바로잡기 | 마이그레이션 `20261014090000_fix_net_worth_snapshot_label_and_cash` — 2026-07 이후 행 이름표 +1달(옛 2026-07 값은 덮어써져 비게 된다), `cash_total` 새 식으로 재계산, `total_assets` 에서 그 달 말까지 자산이동 누계를 뺀다. 배포 전 아래 SQL 로 운영 값을 확인한다 |
| 화면 (§4.4 · §5) | 가계부 잔액 음수 부호(`won()` 이 부호를 살린다) · 잔액/실소비 문구 · 계정 추가 창 비밀번호 가림(눈 버튼, 생성하면 표시) · 최근 열람 동작 8종 한글 + 대상 이름(`vault` · `export:*` · `all:N`) + 루프백 IP '이 기기' · 자산 종합 증감 ▼ 빨강 · 알림 열 때 읽음 토스트 제거 · 대시보드 활성 구독 = 결제 중 + 체험("체험 N건 포함", D6) · 순자산 카드 설명 '자산 − 부채' → '현금 + 예적금 + 투자' |
| 운영 확인 (2026-10-14) | 시스템 로그 · `job_run` 기준 각 이름표의 마지막 저장은 다음 달 하순 — 07 ← 8/31, 08 ← 9/28, 09 ← 10/12(KST). 이름표 +1달이 맞다. 7월 말 값(8/1 저장)은 8/24 에 덮어써져 남아 있지 않다 |
| 남은 것 | ~~데모 시드 스냅샷은 현금을 빼고 적혀 있어 이번 달 막대만 튄다~~ → 5단계에서 고침 |

배포 전 운영 확인 (HeidiSQL, `docnexus`):

```sql
-- 스냅샷 크론이 실제로 언제 돌았는지 — 이름표를 한 달 미는 근거(마지막 실행이 다음 달 하순인지)
SELECT started_at, status, summary FROM job_run WHERE job = 'net-worth-snapshot' ORDER BY started_at;
-- 바로잡기 전 스냅샷과 그 달 말까지 자산이동 누계
SELECT s.month, s.total_assets, s.cash_total,
  (SELECT COALESCE(SUM(t.amount), 0) FROM `transaction` t
    WHERE t.user_id = s.user_id AND t.deleted_at IS NULL AND t.type = 'transfer'
      AND t.date < DATE_ADD(CONCAT(s.month, '-01'), INTERVAL 1 MONTH)) AS transfer_until_month_end
FROM net_worth_snapshot s ORDER BY s.user_id, s.month;
```

### 4. 디자인 개편

- 기획서 `docs/planning.md`(남는 12개 화면 · 화면마다 다루는 데이터 · 자주 쓰는 정도 · 디자인 방향)를 쓴다 — 1단계와 같이 진행해도 된다.
- 기획서 + 현재 화면 캡처(로컬 · 샘플 데이터)를 Claude 디자인에 넣어 시안을 뽑는다 → `docs/design/` 에 시안 + 점검 문서(career-notes `ledger-review.md` 처럼).
  - (완료 2026-10-13) 시안 `docs/design/life-ledger-main.html` · `life-ledger-components.html`, 점검 `docs/design/life-ledger-review.md` — 판정 D1 ~ D9 확정. 그리지 않은 창(투자 항목 추가 · 자동이체 설정 등)은 추가로 요청한다.
- 시안을 확정한 뒤 공통 요소(`ui/*`) → 화면 순서로 바꾼다.
- 대시보드는 이때 고정 레이아웃으로 다시 잡는다.
- 공통 요소 규칙과 `ui-conventions.test.ts` 는 그대로 지킨다.

#### 4단계 진행 상황 (`develop`)

토큰 이름은 지금 앱 이름(`--bg-*` · `--text-*` · `--accent` …)을 그대로 두고 값만 시안 값으로 바꾼다 — 화면 코드 · 소스 검사 테스트를 건드리지 않으려고(점검 문서 §7 첫 항목). 돈 색은 `--success`(수입) · `--danger`(지출) · `--blue`(이동) · `--warning` 으로 강조(금빛)와 나눈다.

| 순서 | 내용 | 상태 |
| --- | --- | --- |
| 1 | 토큰 · 글꼴(Cormorant + Noto Serif KR 제목, Pretendard 본문 · 숫자) · 모서리 4 / 7px · 카드 그림자 없앰 · 주 버튼 D2 · 돈 색 클래스 | 완료 (2026-10-14) |
| 2 | 공통 요소: 아이콘 lucide 로(`icons.tsx` 이름 유지) · 숫자 띠(`StatStrip` + `StatCard valueTone`) · 막대 차트(`BarChart`) · 버튼 크기 30 / 36 / 44 · Badge · Card(선만) · Toggle · Tabs(스크롤바) · Segmented · Field 오류 아이콘 · Modal(sm 380 · md 520 · lg 720, 휴대폰 아래 시트) · ConfirmModal · 오류 배너 · 페이지 번호 · 조회 줄 · 엑셀 줄 · 표 · 체크박스 | 완료 (2026-10-14). 더보기 메뉴 · 표 머리 정렬 · 관리 열 규칙은 화면 단계에서(표마다 칸 정렬이 달라서) |
| 3 | 껍데기: 사이드바 232 · 메뉴 묶음 · TopBar 56(검색 상자 + 종 + 테마) · 휴대폰 아래 메뉴 5칸 + 더보기 시트 | 완료 (2026-10-14). 메뉴 정의는 `lib/nav.tsx` 하나(사이드바 · 전체 메뉴 시트 공용), 글자 로고 `Wordmark`, 상단바는 페이지 이름을 빼고 `topbarLabel` prop 제거 |
| 4 | 화면 12개 + 로그인 (시안 · 점검 §3 · §4 · §9 대로) | 완료 (2026-10-14). 화면 묶음마다 커밋. 마무리로 Card · SettingGroup tone, Segmented fill, BarChart delta, StatCard warn, 잠금 띠 남은 시간 보강 |

시안과 다르게 둔 것 (화면 확인 때 판단):

- 이메일 로그인은 지금처럼 이메일 → 인증코드 두 단계 (시안은 한 화면).
- 구독 목록은 서버 순서(생성일) 그대로 — 쪽마다 다시 정렬하면 쪽 사이 순서가 어긋난다. 결제 순서는 위의 띠가 맡는다.
- 캘린더의 '다가오는 일정' 카드 · 연월 드롭다운은 시안에 없어 뺐다(일정 삭제는 상세 창에서).
- 투자 행은 매수 · 매도 두 버튼 + 더보기(시안과 같고, 휴대폰에서는 더보기 하나).
- 설정의 계정 JSON 은 암호화 백업이라 시안의 '평문 경고 확인'을 넣지 않았다.

**겉모양 되돌림 (2026-10-14).** 시안의 명조 제목 · 기울인 로고 · 종이색 바탕 · 금빛 강조가 AI 디자인 도구의 흔한 조합이라 AI 느낌이 나고 개편 전보다 못하다는 판단으로, 화면 구조 · 공통 요소는 두고 겉모양만 개편 전(초록 · 흰 카드) 쪽으로 돌렸다. 판정 D1(제목 명조) · D2(테두리 주 버튼)는 이걸로 뒤집혔다.

- 글꼴은 Pretendard 하나. 제목 · 금액은 굵게(700), `--font-display` 는 이름만 남기고 본문 글꼴을 가리킨다.
- 강조색은 개편 전 초록 `#00C07F` — 채우는 데만 쓰고, 글자 · 주 버튼 바탕은 흰 바탕 대비 4.5:1 을 넘는 `--accent-dark #007A4D`. 회색 · 빨강 · 주황 · 파랑 글자색도 같은 기준으로 진하게 잡았다(개편 전 값은 대비 미달).
- 바탕 `#F5F6F8` 위에 흰 카드 + 옅은 그림자, 모서리 8 / 14px. 숫자 띠는 칸마다 따로 뜬 카드(옅은 색 네모 아이콘), 표 바깥(`.table-wrap`)도 흰 카드 — 카드 안에 넣은 표는 `flat`.
- 주 버튼은 채운 초록, 사이드바 · 상단바는 흰 바탕, 고른 메뉴는 둥근 옅은 초록 바탕.
- 막대 차트는 지난 막대를 옅은 회색, 이번 달만 돈 색으로.

### 5. 데모 인스턴스

- 같은 홈서버에 따로 띄운다: DB `<이름>_demo`(전용 사용자), 파일 저장소 분리(별도 버킷이나 접두사 + 용량 제한), 앱 전용 Tailscale 사이드카(호스트명 따로, Funnel 켬).
- 로그인 화면의 "데모로 둘러보기" 버튼 — `DEMO_MODE=true` 일 때만 열리는 로그인 경로. 운영 인스턴스에서는 라우트 자체가 없게 한다.
- 샘플 데이터: 기존 `prisma/seeds` 를 데모용으로 다듬고, 매일 새벽 초기화한다.
  - (완료 2026-10-13, 디자인 캡처 때문에 당겨서) 시드 날짜를 **실행한 날 기준**으로 옮긴다(`seeds/helpers.ts` 의 `ds` — 2026-06-10 을 오늘로 보고 적은 날짜를 달 차이만큼 이동). 만기 · 체험 종료 임박은 오늘부터 며칠 뒤로, 구독 결제일은 오늘 이후 첫 결제일로, 반복 거래는 오늘까지의 회차를 같이 넣는다. 캘린더 직접 일정 · 거래 즐겨찾기 시드를 새로 넣고, 알림 · 시스템 로그 문구를 앱이 실제로 남기는 것으로 바꿨다(예산 · SSL · 보안 점수 같은 없는 기능 제거). 다시 넣을 때 자동이체 설정이 쌓이던 것도 고쳤다.
  - 대시보드 '활성 구독 13건'과 현금흐름 예측 '구독 15건' 차이는 무료 체험 2건 — 예측은 곧 과금될 체험도 센다. 디자인 점검 D6 에서 '활성 = 활성 + 체험' 으로 맞추고 "체험 N건 포함" 을 붙이기로 했다.
  - 반복매수 설정은 `last_period` 를 이번 달로 넣는다 — 비워 두면 예약 작업이 종목 매수일(최대 2년 전)부터 모든 회차를 한 번에 사들인다(시세 조회 수십 번 + 예수금 소진).
- 메일 · 웹 푸시 발송은 끈다.

#### 5단계 진행 상황 (2026-10-14, `develop` — 코드 완료, 홈서버 작업 남음)

| 항목 | 결과 |
| --- | --- |
| 데모 로그인 | `DEMO_MODE=true` 일 때만 `DemoAuthController`(`POST /auth/demo`, 분당 10회)를 등록 — 데모 사용자(`demo@life-ledger.local`)를 만들거나 찾아 세션을 준다. 운영은 라우트 자체가 없다(부팅 로그 `Mapped` 에 안 나온다) |
| 막는 동작 | 계정 삭제 · 마스터 잠금 변경/해제 → 403 "데모에서는 … 할 수 없습니다." (`common/demo.ts` `assertNotDemo`) |
| 파일 한도 | `STORAGE_QUOTA_MB` — 사용자별 합계를 업로드 때 검사(미설정이면 한도 없음) |
| 매일 초기화 | `pnpm demo:reset` (= `tsx prisma/demo-reset.ts`) — `DEMO_MODE` 가 `'true'` 가 아니면 거부. `_prisma_migrations` · `holiday` · `job_run` 을 뺀 전 테이블을 비우고 시드 → 데모 사용자 마스터 잠금(`demo1234`, 5분)을 건다. 실행 이미지에는 `src` 가 없어 `process.env` 만 읽는다 |
| 화면 | 빌드 인자 `NEXT_PUBLIC_DEMO_MODE=true` 일 때 로그인 화면은 '데모로 둘러보기' 만(Google · 이메일 대신), 모든 화면 맨 위에 데모 띠(매일 4시 초기화 · 마스터 비밀번호 안내) |
| 시드 | 순자산 스냅샷에 그 달 말 현금(수입 − 지출 − 자산이동)을 넣는다 — 수입/지출 시드 뒤에 계산. 추이 차트 이번 달 막대가 더 이상 튀지 않는다 |
| 배포 | `docker-compose.demo.yml`(운영 compose 위에 덮는다 — 프로젝트 `life-ledger-demo`, 포트 3010 · 8010, DB `lifeledger_demo`, Tailscale `lifeledger-demo`, 볼륨 이름 분리). 배포 워크플로는 홈서버에 `.env.demo` · `backend/.env.demo` 가 있을 때만 운영 배포 뒤 데모도 다시 띄운다 |
| 로컬 확인 | 데모 env 로 띄워 로그인 → 대시보드 · 데모 띠 · 잠금 풀기(demo1234) · 잠금 해제/계정 삭제 403 확인. 정상 env 로 다시 띄우면 데모 버튼 · 띠 · 라우트가 없다 |
| 남은 것 | 아래 운영 절차(홈서버 · B2 · Tailscale) — 사용자 확인 뒤. 파일 보관함 샘플 파일은 시드에 없다(빈 목록) |

#### 5단계 운영 절차 (홈서버 — 한 번)

같은 클론 `~/apps/life-ledger` 에서 compose 파일 하나를 더 얹어 띄운다(폴더 규칙 `~/apps/<레포>` 유지). 아래에서 `DEMO` 는 이 명령의 줄임:

```bash
docker compose -p life-ledger-demo --env-file .env.demo -f docker-compose.yml -f docker-compose.demo.yml
```

1. **DB** (HeidiSQL root 세션, 홈서버 23306) — infra README 와 같은 형식:

   ```sql
   CREATE DATABASE IF NOT EXISTS `lifeledger_demo` CHARACTER SET utf8mb4;
   CREATE USER IF NOT EXISTS 'lifeledger_demo'@'%' IDENTIFIED BY '<비밀번호>';
   GRANT ALL PRIVILEGES ON `lifeledger_demo`.* TO 'lifeledger_demo'@'%';
   ```

   infra `initdb/01-app-databases.sh` 에도 같은 줄을 넣어 볼륨을 새로 만들 때 다시 생기게 한다.
2. **B2** — 데모 전용 버킷 + 그 버킷만 쓰는 애플리케이션 키. 초기화는 DB 행만 지우고 B2 파일은 남기므로, 버킷 수명 주기 규칙으로 정리한다(`daysFromUploadingToHiding: 1` · `daysFromHidingToDeleting: 1`).
3. **env 파일** (git · docker 빌드 제외 — `.gitignore` · `.dockerignore` 에 `.env.demo`). 값은 출력하지 않는다.
   - 루트 `.env.demo`: `DB_PASSWORD`(1의 비밀번호) · `NEXT_PUBLIC_BACKEND_URL=https://lifeledger-demo.tailba78c1.ts.net` · `NEXT_PUBLIC_API_URL`(같은 주소 + `/api/v1`) · `NEXT_PUBLIC_DEMO_MODE=true` · `TS_AUTHKEY`(tag:app 키) · `COMPOSE_PROFILES=homeserver`
   - `backend/.env.demo`: 운영 `backend/.env` 를 복사한 뒤 바꾼다 — `JWT_*` 세 개와 `CRYPTO_KEYS` 는 **새로 만든 값**(운영 키를 데모에 두지 않는다), `CREDENTIAL_SECRET` 비움, `FRONTEND_URL` · `CORS_ORIGINS` · `GOOGLE_CALLBACK_URL` 을 데모 주소로, `GOOGLE_*` 는 아무 값(데모 화면에 Google 버튼이 없다), `ALLOWED_EMAILS=nobody@life-ledger.local`(이메일 로그인 막기), B2 는 2의 버킷 · 키, `SMTP_*` · `VAPID_*` 비움, `DEMO_MODE=true`, `STORAGE_QUOTA_MB=50`
4. **처음 띄우기**: `DEMO build` → `DEMO run --rm --no-deps backend node dist/config/check-env.js` → `DEMO run --rm backend npx prisma migrate deploy` → `DEMO up -d` → `DEMO exec -T backend npx tsx prisma/demo-reset.ts`(샘플 데이터 · 잠금). 그 뒤로는 main push 때 워크플로가 같이 갱신한다.
5. **매일 초기화** — 홈서버 사용자 crontab(sudo 불필요, 홈서버 시계는 UTC → KST 04:00 = UTC 19:00):

   ```cron
   0 19 * * * cd ~/apps/life-ledger && docker compose -p life-ledger-demo --env-file .env.demo -f docker-compose.yml -f docker-compose.demo.yml exec -T backend npx tsx prisma/demo-reset.ts 2>&1 | logger -t life-ledger-demo
   ```

   확인: `journalctl -t life-ledger-demo --since today`
6. **확인**: `https://lifeledger-demo.tailba78c1.ts.net` — 데모 버튼 · 띠 · 잠금 풀기 · 계정 삭제 403. Tailscale 관리 화면에서 노드 `lifeledger-demo` 의 Funnel 켜짐. 운영 `https://lifeledger…` 로그인 화면에는 데모 버튼이 없어야 한다.
7. infra `README.md` 외부 접속 표 · 워크스페이스 `CLAUDE.md` 에 데모 주소를 적는다.

### 6. 공개

- 방식(A/B) 결정 → 비밀값 · 내부 정보 검사(gitleaks, tailnet 주소, 홈서버 경로, 화이트리스트).
- README: 한 줄 소개 · 데모 링크 · 화면 캡처 · 구조도 · 기술 선택 이유 · 트러블슈팅. 소재:
  - 필드 + 사용자 문맥(AAD)으로 묶은 AES-256-GCM, 키 교체와 부팅 시 재암호화, 배포 전 전체 복호화 점검
  - 알림 + 푸시 아웃박스 (한 트랜잭션)
  - 예약 작업 실행 기록 · 겹침 방지 (core-jobs)
  - 홈서버 배포 16~30분 → 4분 (2026-10-13, Dockerfile `chown -R` 원인 분석)
- young-core 공개.
