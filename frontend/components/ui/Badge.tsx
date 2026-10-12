/**
 * 공통 배지 (Tailwind). tone 으로 색, size 로 크기 구분.
 * solid-warning · overlay 는 색 카드 위에 얹는 용도.
 */
import type { HTMLAttributes, ReactNode } from 'react';

type Tone = 'success' | 'warning' | 'danger' | 'neutral' | 'blue' | 'solid-warning' | 'overlay';
type Size = 'md' | 'sm';

const TONE: Record<Tone, string> = {
  success: 'bg-accent-dim text-accent',
  warning: 'bg-warning-dim text-warning',
  danger: 'bg-danger-dim text-danger',
  neutral: 'bg-elevated text-secondary',
  blue: 'bg-blue-dim text-blue',
  'solid-warning': 'bg-warning text-white',
  overlay: 'bg-white/20',
};

const SIZE: Record<Size, string> = {
  md: 'px-2.5 py-0.5 text-[0.72rem] font-semibold',
  sm: 'px-2 py-0.5 text-[0.7rem] font-bold',
};

export default function Badge({
  tone = 'neutral',
  size = 'md',
  className = '',
  children,
  ...rest
}: { tone?: Tone; size?: Size; children: ReactNode } & HTMLAttributes<HTMLSpanElement>) {
  return (
    <span className={`inline-flex items-center rounded-full ${SIZE[size]} ${TONE[tone]} ${className}`.trim()} {...rest}>
      {children}
    </span>
  );
}
