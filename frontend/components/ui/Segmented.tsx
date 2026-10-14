/**
 * 알약 · 묶음 모양의 선택 버튼 줄. role="tablist" / "tab" / aria-selected 를 갖는다.
 * variant 로 모양(solid 거르기 알약 · soft 연한 칸 · joined 값 고르기 묶음), size 로 크기를 정한다.
 */
import type { ReactNode } from 'react';

export type SegmentedItem<T extends string> = { value: T; label: ReactNode };

type Variant = 'solid' | 'soft' | 'joined';
type Size = 'xs' | 'sm' | 'md';

const LIST: Record<Variant, string> = {
  solid: 'flex gap-1.5',
  soft: 'flex gap-2',
  joined: 'inline-flex rounded-ui border border-border divide-x divide-border overflow-hidden text-[0.8125rem]',
};

const SIZE: Record<Size, string> = {
  xs: 'px-2.5 py-[5px] text-[0.78rem]',
  sm: 'px-3.5 py-1.5 text-[0.82rem]',
  md: 'px-4 py-2 text-[0.855rem]',
};

const ITEM: Record<Variant, { base: string; on: string; off: string }> = {
  solid: {
    base: 'rounded-full border cursor-pointer transition-colors whitespace-nowrap shrink-0',
    on: 'bg-accent-dim border-accent text-accent-dark',
    off: 'bg-transparent border-border text-muted hover:text-primary',
  },
  soft: {
    base: 'rounded-ui border cursor-pointer transition-colors',
    on: 'bg-accent-dim text-accent-dark border-accent',
    off: 'bg-transparent text-secondary border-border hover:bg-surface hover:text-primary',
  },
  joined: {
    base: 'px-3 py-1.5 transition-colors cursor-pointer whitespace-nowrap',
    on: 'ring-1 ring-inset ring-accent text-accent-dark',
    off: 'text-primary hover:bg-surface',
  },
};

export default function Segmented<T extends string>({
  items,
  value,
  onChange,
  label,
  variant = 'solid',
  size = 'sm',
  fill = false,
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
  /** 줄 너비를 꽉 채우고 칸을 똑같이 나눈다 (창 안 고르기 칸) */
  fill?: boolean;
  className?: string;
}) {
  const it = ITEM[variant];
  return (
    <div role="tablist" aria-label={label} className={`${LIST[variant]} ${fill ? 'w-full' : ''} ${className}`.trim()}>
      {items.map((item) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={active}
            className={`${it.base} ${variant === 'joined' ? '' : SIZE[size]} ${fill ? 'flex-1 px-1' : ''} ${active ? it.on : it.off}`}
            onClick={() => onChange(item.value)}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
