/**
 * 공통 배지 (Tailwind). tone 으로 색, size 로 크기 구분. 상태에만 쓴다 — 카테고리 · 유형 같은 분류는 글자로.
 * solid-warning · overlay 는 색 카드 위에 얹는 용도.
 */
import type { HTMLAttributes, ReactNode } from 'react';

type Tone = 'success' | 'warning' | 'danger' | 'neutral' | 'blue' | 'solid-warning' | 'overlay';
type Size = 'md' | 'sm';

const TONE: Record<Tone, string> = {
  success: 'bg-success-dim text-success ring-1 ring-inset ring-success/35',
  warning: 'bg-warning-dim text-warning ring-1 ring-inset ring-warning/35',
  danger: 'bg-danger-dim text-danger ring-1 ring-inset ring-danger/35',
  neutral: 'text-muted ring-1 ring-inset ring-border',
  blue: 'bg-blue-dim text-blue ring-1 ring-inset ring-blue/35',
  'solid-warning': 'bg-warning text-on-solid',
  overlay: 'bg-white/20',
};

const SIZE: Record<Size, string> = {
  md: 'px-[7px] py-1 text-[0.72rem] leading-none gap-1',
  sm: 'px-1.5 py-[3px] text-[0.6875rem] leading-none gap-1',
};

export default function Badge({
  tone = 'neutral',
  size = 'md',
  className = '',
  children,
  ...rest
}: { tone?: Tone; size?: Size; children: ReactNode } & HTMLAttributes<HTMLSpanElement>) {
  return (
    <span className={`inline-flex items-center rounded-[2px] whitespace-nowrap ${SIZE[size]} ${TONE[tone]} ${className}`.trim()} {...rest}>
      {children}
    </span>
  );
}
