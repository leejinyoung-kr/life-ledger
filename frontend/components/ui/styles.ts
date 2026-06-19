/**
 * 페이지 전역에서 반복되는 Tailwind 클래스 문자열 모음.
 * Button.tsx 의 buttonClasses() 와 별개로, <button>/<div> 등 일반 엘리먼트에
 * 직접 적용되는 아이콘 버튼/구분선 등의 클래스를 한곳에서 관리한다.
 */

// 드래그 핸들 등에 쓰이는 정사각형 아이콘 버튼 (w-7 h-7)
export const ICON_BTN_SQUARE =
  'flex items-center justify-center w-7 h-7 rounded-[var(--radius)] text-muted cursor-grab transition-colors hover:bg-elevated hover:text-secondary shrink-0 touch-none active:cursor-grabbing';

// 캘린더/파일뷰어 등 상단 네비게이션·닫기 버튼 (w-[34px] h-[34px], 테두리 있음)
export const NAV_BTN_34 =
  'w-[34px] h-[34px] inline-flex items-center justify-center rounded-[var(--radius)] text-secondary border border-border transition-all hover:bg-surface hover:text-primary';

// 툴바 액션 그룹 사이를 구분하는 세로 구분선 (반응형으로 모바일에서 숨김)
export const TOOLBAR_DIVIDER = 'w-px h-5 bg-border max-md:hidden';
