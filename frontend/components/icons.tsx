/**
 * 공통 SVG 아이콘 모음.
 * 사이드바 / 탑바 / 대시보드 위젯에서 재사용한다.
 * 모든 아이콘은 currentColor 를 사용해 부모 color 로 색이 결정된다.
 */
import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

// 공통 stroke 기반 아이콘 베이스 — viewBox/stroke 속성 통일
function Stroke({ children, ...rest }: IconProps & { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} {...rest}>
      {children}
    </svg>
  );
}

// 대시보드(그리드 4칸) 아이콘
export const IconGrid = (p: IconProps) => (
  <Stroke {...p}>
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
    <rect x="14" y="14" width="7" height="7" rx="1" />
  </Stroke>
);

// 금융/차트 아이콘
export const IconChart = (p: IconProps) => (
  <Stroke {...p}>
    <path d="M3 3v18h18" />
    <path d="M7 14l4-4 3 3 5-6" />
  </Stroke>
);

// 가계부(원화) 아이콘
export const IconWon = (p: IconProps) => (
  <Stroke {...p}>
    <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
  </Stroke>
);

// 구독(반복) 아이콘
export const IconRepeat = (p: IconProps) => (
  <Stroke {...p}>
    <polyline points="17 1 21 5 17 9" />
    <path d="M3 11V9a4 4 0 0 1 4-4h14" />
    <polyline points="7 23 3 19 7 15" />
    <path d="M21 13v2a4 4 0 0 1-4 4H3" />
  </Stroke>
);

// 자산 종합(파이) 아이콘
export const IconPie = (p: IconProps) => (
  <Stroke {...p}>
    <path d="M21.21 15.89A10 10 0 1 1 8 2.83" />
    <path d="M22 12A10 10 0 0 0 12 2v10z" />
  </Stroke>
);

// 보관함(폴더) 아이콘
export const IconFolder = (p: IconProps) => (
  <Stroke {...p}>
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
  </Stroke>
);

// 계정/자물쇠 아이콘
export const IconLock = (p: IconProps) => (
  <Stroke {...p}>
    <rect x="3" y="11" width="18" height="11" rx="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </Stroke>
);

// ENV(코드) 아이콘
export const IconCode = (p: IconProps) => (
  <Stroke {...p}>
    <polyline points="4 17 10 11 4 5" />
    <line x1="12" y1="19" x2="20" y2="19" />
  </Stroke>
);

// 신원 지갑(ID 카드) 아이콘
export const IconIdCard = (p: IconProps) => (
  <Stroke {...p}>
    <rect x="2" y="4" width="20" height="16" rx="2" />
    <circle cx="8" cy="10" r="2" />
    <path d="M13 9h5M13 13h5M5 16h14" />
  </Stroke>
);

// 문서/메모 아이콘
export const IconDoc = (p: IconProps) => (
  <Stroke {...p}>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
  </Stroke>
);

// 할일(체크) 아이콘
export const IconCheckSquare = (p: IconProps) => (
  <Stroke {...p}>
    <polyline points="9 11 12 14 22 4" />
    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
  </Stroke>
);

// 캘린더 아이콘
export const IconCalendar = (p: IconProps) => (
  <Stroke {...p}>
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </Stroke>
);

// 인사이트/큐브(AI 리포트) 아이콘
export const IconCube = (p: IconProps) => (
  <Stroke {...p}>
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
    <path d="M12 22V12M3.27 6.96 12 12.01l8.73-5.05" />
  </Stroke>
);

// AI 챗(말풍선) 아이콘
export const IconChat = (p: IconProps) => (
  <Stroke {...p}>
    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
  </Stroke>
);

// 설정(톱니) 아이콘
export const IconSettings = (p: IconProps) => (
  <Stroke {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </Stroke>
);

// 보안(방패) 아이콘
export const IconShield = (p: IconProps) => (
  <Stroke {...p}>
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    <polyline points="9 12 11 14 15 10" />
  </Stroke>
);

// 알림(종) 아이콘
export const IconBell = (p: IconProps) => (
  <Stroke {...p}>
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </Stroke>
);

// 휴지통 아이콘
export const IconTrash = (p: IconProps) => (
  <Stroke {...p}>
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6l-1 14H6L5 6" />
    <path d="M10 11v6M14 11v6" />
    <path d="M9 6V4h6v2" />
  </Stroke>
);

// 햄버거(메뉴) 아이콘
export const IconMenu = (p: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} {...p}>
    <line x1="3" y1="6" x2="21" y2="6" />
    <line x1="3" y1="12" x2="21" y2="12" />
    <line x1="3" y1="18" x2="21" y2="18" />
  </svg>
);

// 검색(돋보기) 아이콘
export const IconSearch = (p: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} {...p}>
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.35-4.35" />
  </svg>
);

// 더하기(추가) 아이콘
export const IconPlus = (p: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} {...p}>
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

// 캐럿(아래 화살표) — 접이식 메뉴 표시
export const IconCaret = (p: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} {...p}>
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

// 로그아웃 아이콘
export const IconLogout = (p: IconProps) => (
  <Stroke {...p}>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </Stroke>
);

// 업로드 아이콘
export const IconUpload = (p: IconProps) => (
  <Stroke {...p}>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" y1="3" x2="12" y2="15" />
  </Stroke>
);

// 수정(연필) 아이콘
export const IconEdit = (p: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} {...p}>
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);

// 닫기(X) 아이콘
export const IconClose = (p: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} {...p}>
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

// 다운로드(트레이로 내려받기) 아이콘
export const IconDownload = (p: IconProps) => (
  <Stroke {...p}>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </Stroke>
);

// 양식(문서) 다운로드 아이콘
export const IconFileBlank = (p: IconProps) => (
  <Stroke {...p}>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
  </Stroke>
);

// 예적금(통장/카드) 아이콘
export const IconBank = (p: IconProps) => (
  <Stroke {...p}>
    <rect x="2" y="5" width="20" height="14" rx="2" />
    <line x1="2" y1="10" x2="22" y2="10" />
  </Stroke>
);

// 투자(상승 차트) 아이콘
export const IconTrendUp = (p: IconProps) => (
  <Stroke {...p}>
    <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
    <polyline points="16 7 22 7 22 13" />
  </Stroke>
);

// 체크(완료) 아이콘
export const IconCheck = (p: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} {...p}>
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

// 복사 아이콘
export const IconCopy = (p: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} {...p}>
    <rect x="9" y="9" width="13" height="13" rx="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);

// 표시/숨김(눈) 아이콘
export const IconEye = (p: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} {...p}>
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

// 경고(삼각형 느낌표) 아이콘
export const IconAlertTriangle = (p: IconProps) => (
  <Stroke {...p}>
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </Stroke>
);

// DocNexus 로고(2x2 사각형) 아이콘
export const IconLogo = (p: IconProps) => (
  <svg viewBox="0 0 22 22" fill="none" {...p}>
    <rect x="2" y="2" width="8" height="8" rx="2" fill="var(--accent)" />
    <rect x="12" y="2" width="8" height="8" rx="2" fill="var(--accent)" opacity=".3" />
    <rect x="2" y="12" width="8" height="8" rx="2" fill="var(--accent)" opacity=".3" />
    <rect x="12" y="12" width="8" height="8" rx="2" fill="var(--accent)" opacity=".12" />
  </svg>
);
