# DocNexus — Frontend

Next.js (App Router) 기반 웹 클라이언트

## 실행

```bash
# 의존성 설치 (루트에서)
pnpm install

# 개발 서버 (포트 3000)
pnpm dev
```

## 주요 명령어

```bash
pnpm dev      # 개발 서버 실행
pnpm build    # 프로덕션 빌드
pnpm start    # 프로덕션 서버 실행
pnpm lint     # 린트
```

## 구조

```text
frontend/
├── app/
│   ├── (app)/             # 인증 필요 페이지 (AppShell 레이아웃)
│   │   ├── dashboard/     # 대시보드
│   │   ├── transactions/  # 수입/지출 내역
│   │   ├── networth/      # 순자산
│   │   ├── subscriptions/ # 구독 관리
│   │   ├── tasks/         # 할 일 / 목표
│   │   ├── notes/         # 메모
│   │   ├── calendar/      # 캘린더
│   │   ├── notifications/ # 알림
│   │   ├── security/      # 보안
│   │   ├── settings/      # 설정
│   │   ├── trash/         # 휴지통
│   │   ├── credentials/   # 계정 보관함 (백엔드 연동 — AES 암호화)
│   │   ├── envs/          # ENV 보관함 (백엔드 연동 — AES 암호화)
│   │   ├── id-wallet/     # 신원 지갑 (백엔드 연동 — AES 암호화)
│   │   ├── files/         # 파일 보관함 (백엔드 연동 — Backblaze B2)
│   │   ├── ai-report/     # AI 리포트 (구현 완료, 백엔드 연동)
│   │   └── logs/          # 시스템 로그 (구현 완료, 백엔드 연동)
│   ├── auth/callback/     # OAuth 콜백 처리
│   ├── layout.tsx         # 루트 — Providers(React Query) 마운트
│   └── login/             # 로그인 페이지
├── components/
│   ├── AppShell.tsx       # 사이드바 + TopBar + BottomNav 레이아웃
│   ├── Providers.tsx      # QueryClientProvider (React Query)
│   ├── BottomNav.tsx      # 모바일 하단 내비게이션
│   ├── GlobalSearch.tsx   # 통합 검색 (도메인 필터·최근검색)
│   ├── Modal.tsx          # 공통 모달
│   ├── Sidebar.tsx        # 사이드바
│   ├── StatCard.tsx       # 통계 카드
│   ├── TopBar.tsx         # 상단 헤더 (다크 토글·미읽음 폴링)
│   ├── VaultUnlockModal.tsx # 마스터 잠금 해제 모달 (423 자동)
│   └── icons.tsx          # SVG 아이콘 모음
└── lib/
    ├── api.ts             # fetch 래퍼 (401 refresh·423 vault·x-vault-token)
    ├── query.ts           # useApiQuery / useApiMutation / useInvalidate
    ├── queryKeys.ts       # 쿼리 키 팩토리 (전 도메인)
    ├── vault.ts           # 마스터 잠금 토큰 (메모리)
    └── ...                # 도메인별 타입·유틸
```

> 서버 데이터는 전부 **React Query**(useApiQuery/useApiMutation). 페이지 재진입 시 30초 캐시, 저장 후 invalidate 로 자동 갱신.

## 접속

<http://localhost:3000>
