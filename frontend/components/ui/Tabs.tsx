/**
 * 화면을 나누는 탭 (밑줄 · 세로). role="tablist" / "tab" / aria-selected 를 갖는다.
 * 알약 모양의 선택 버튼은 Segmented 를 쓴다. className 은 배치용(패딩 · sticky 등)이다.
 */
import type { ReactNode } from 'react';

export type TabItem<T extends string> = { value: T; label: ReactNode; icon?: ReactNode };

type Variant = 'underline' | 'vertical';
type Size = 'sm' | 'md';

// underline: 가로 밑줄 탭 / vertical: 카드 안 세로 목록 (모바일에서는 가로 스크롤)
const LIST: Record<Variant, string> = {
  // overflow-y-hidden — 탭의 -mb-px 때문에 휴대폰에서 세로 스크롤바가 생기던 것(시안 점검 §3-6)
  underline: 'flex gap-6 border-b border-border overflow-x-auto overflow-y-hidden scrollbar-none max-md:gap-4',
  vertical: 'border border-border rounded-ui p-2 flex flex-col gap-0.5 max-md:flex-row max-md:flex-nowrap max-md:overflow-x-auto max-md:scrollbar-none',
};

const TAB_BASE = 'cursor-pointer transition-all whitespace-nowrap shrink-0';

// 밑줄 탭: sm 은 카드 안 환경 탭, md 는 페이지 상단 탭
const UNDERLINE_SIZE: Record<Size, { base: string; on: string; off: string }> = {
  sm: {
    base: 'py-2 text-[0.82rem] border-b-2 -mb-px flex items-center gap-1.5 [&_svg]:w-3.5 [&_svg]:h-3.5',
    on: 'text-primary border-accent',
    off: 'text-muted border-transparent hover:text-primary hover:border-border-hover',
  },
  md: {
    base: 'py-2.5 text-[0.875rem] border-b-2 -mb-px flex items-center gap-1.75 [&_svg]:w-4 [&_svg]:h-4 max-md:text-[0.82rem]',
    on: 'text-primary border-accent',
    off: 'text-muted border-transparent hover:text-primary hover:border-border-hover',
  },
};

const VERTICAL_TAB = {
  base: 'px-3 py-2 rounded-ui text-[0.855rem] text-left',
  on: 'bg-accent-dim text-accent-dark',
  off: 'text-secondary hover:bg-hover hover:text-primary',
};

export default function Tabs<T extends string>({
  items,
  value,
  onChange,
  label,
  variant = 'underline',
  size = 'sm',
  className = '',
}: {
  items: TabItem<T>[];
  value: T;
  onChange: (value: T) => void;
  /** 탭 목록의 접근성 이름 */
  label: string;
  variant?: Variant;
  /** underline 에서만 의미 있다 */
  size?: Size;
  className?: string;
}) {
  const cls = variant === 'vertical' ? VERTICAL_TAB : UNDERLINE_SIZE[size];
  return (
    <div role="tablist" aria-label={label} className={`${LIST[variant]} ${className}`.trim()}>
      {items.map((it) => {
        const active = it.value === value;
        return (
          <button
            key={it.value}
            type="button"
            role="tab"
            aria-selected={active}
            className={`${TAB_BASE} ${cls.base} ${active ? cls.on : cls.off}`}
            onClick={() => onChange(it.value)}
          >
            {it.icon}{it.label}
          </button>
        );
      })}
    </div>
  );
}
