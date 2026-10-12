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
  underline: 'flex overflow-x-auto scrollbar-none',
  vertical: 'bg-background border border-border rounded-lg p-2.5 flex flex-col gap-0.5 shadow-(--shadow-sm) max-md:flex-row max-md:flex-nowrap max-md:overflow-x-auto max-md:scrollbar-none',
};

const TAB_BASE = 'cursor-pointer transition-all whitespace-nowrap shrink-0';

// 밑줄 탭: sm 은 카드 안 환경 탭, md 는 페이지 상단 탭
const UNDERLINE_SIZE: Record<Size, { base: string; on: string; off: string }> = {
  sm: {
    base: 'px-4 py-2 text-[0.82rem] border-b-2 -mb-px flex items-center gap-1.5 font-medium',
    on: 'text-accent border-accent font-semibold',
    off: 'text-muted border-transparent hover:text-secondary',
  },
  md: {
    base: 'px-5 py-2.5 text-[0.875rem] border-b-2 -mb-px flex items-center gap-1.75 font-medium [&_svg]:w-3.75 [&_svg]:h-3.75 max-md:px-3 max-md:text-[0.82rem]',
    on: 'text-accent border-accent font-semibold',
    off: 'text-muted border-transparent hover:text-primary',
  },
};

const VERTICAL_TAB = {
  base: 'px-3 py-2 rounded-(--radius) text-[0.855rem] font-medium text-left',
  on: 'bg-accent-dim text-accent font-semibold',
  off: 'text-secondary hover:bg-surface hover:text-primary',
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
