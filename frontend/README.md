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
│   │   ├── credentials/   # 자격증명 (UI 완료, 백엔드 미구현)
│   │   ├── envs/          # ENV 파일 (UI 완료, 백엔드 미구현)
│   │   ├── files/         # 파일 보관함 (UI 완료, 백엔드 미구현)
│   │   ├── id-wallet/     # 신원 지갑 (UI 완료, 백엔드 미구현)
│   │   ├── ai-report/     # AI 리포트 (UI 완료, 백엔드 미구현)
│   │   └── assistant/     # AI 어시스턴트 (UI 완료, 백엔드 미구현)
│   ├── auth/callback/     # OAuth 콜백 처리
│   └── login/             # 로그인 페이지
├── components/
│   ├── AppShell.tsx       # 사이드바 + TopBar + BottomNav 레이아웃
│   ├── BottomNav.tsx      # 모바일 하단 내비게이션
│   ├── GlobalSearch.tsx   # 통합 검색
│   ├── Modal.tsx          # 공통 모달
│   ├── Sidebar.tsx        # 사이드바
│   ├── StatCard.tsx       # 통계 카드
│   ├── TopBar.tsx         # 상단 헤더 (다크 모드 토글 포함)
│   └── icons.tsx          # SVG 아이콘 모음
└── lib/                   # API 클라이언트 등 유틸
```

## 접속

<http://localhost:3000>
