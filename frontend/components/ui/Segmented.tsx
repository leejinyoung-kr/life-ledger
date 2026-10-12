/**
 * 알약 · 묶음 모양의 선택 버튼 줄. role="tablist" / "tab" / aria-selected 를 갖는다.
 * variant 로 모양(solid 채움 · soft 연한 채움 · joined 붙은 묶음), size 로 크기를 정한다.
 */
import type { ReactNode } from 'react';

export type SegmentedItem<T extends string> = { value: T; label: ReactNode };

type Variant = 'solid' | 'soft' | 'joined';
type Size = 'xs' | 'sm' | 'md';

const LIST: Record<Variant, string> = {
  solid: 'flex gap-1.5',
  soft: 'flex gap-2',
  joined: 'inline-flex rounded-md border border-border divide-x divide-border overflow-hidden text-[0.76rem] font-medium',
};

const SIZE: Record<Size, string> = {
  xs: 'px-2.5 py-[5px] text-[0.78rem]',
  sm: 'px-3.5 py-1.5 text-[0.82rem]',
  md: 'px-4 py-2 text-[0.855rem]',
};

const ITEM: Record<Variant, { base: string; on: string; off: string }> = {
  solid: {
    base: 'rounded-(--radius) border cursor-pointer transition-all whitespace-nowrap shrink-0',
    on: 'bg-accent border-accent text-white font-semibold',
    off: 'bg-background border-border text-secondary hover:bg-surface hover:text-primary',
  },
  soft: {
    base: 'rounded-(--radius) border cursor-pointer font-semibold transition-colors',
    on: 'bg-accent-dim text-accent border-accent',
    off: 'bg-transparent text-secondary border-border hover:bg-surface hover:text-primary',
  },
  joined: {
    base: 'px-2.5 py-1 transition-colors cursor-pointer',
    on: 'bg-primary text-background',
    off: 'bg-background text-muted hover:text-primary',
  },
};

export default function Segmented<T extends string>({
  items,
  value,
  onChange,
  label,
  variant = 'solid',
  size = 'sm',
  className = '',
}: {
  items: SegmentedItem<T>[];
  value: T;
  onChange: (value: T) => void;
  /** 목록의 접근성 이름 */
  label: string;
  variant?: Variant;
  /** joined 는 크기가 고정이라 무시된다 */
  size?: Size;
  className?: string;
}) {
  const it = ITEM[variant];
  return (
    <div role="tablist" aria-label={label} className={`${LIST[variant]} ${className}`.trim()}>
      {items.map((item) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={active}
            className={`${it.base} ${variant === 'joined' ? '' : SIZE[size]} ${active ? it.on : it.off}`}
            onClick={() => onChange(item.value)}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
