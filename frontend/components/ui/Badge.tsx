/**
 * 공통 배지 (Tailwind). tone 으로 색, size 로 크기 구분. 상태에만 쓴다 — 카테고리 · 유형 같은 분류는 글자로.
 * solid-warning · overlay 는 색 카드 위에 얹는 용도.
 */
import type { HTMLAttributes, ReactNode } from 'react';

type Tone = 'success' | 'warning' | 'danger' | 'neutral' | 'blue' | 'solid-warning' | 'overlay';
type Size = 'md' | 'sm';

// 테두리 없이 옅은 바탕 + 같은 색 글자 (흰 카드 위에서 네모 틀이 겹쳐 보이지 않게)
const TONE: Record<Tone, string> = {
  success: 'bg-success-dim text-success',
  warning: 'bg-warning-dim text-warning',
  danger: 'bg-danger-dim text-danger',
  neutral: 'bg-elevated text-secondary',
  blue: 'bg-blue-dim text-blue',
  'solid-warning': 'bg-warning text-on-solid',
  overlay: 'bg-white/20',
};

const SIZE: Record<Size, string> = {
  md: 'px-2 py-1 text-[0.72rem] font-semibold leading-none gap-1',
  sm: 'px-1.5 py-0.75 text-[0.6875rem] font-semibold leading-none gap-1',
};

export default function Badge({
  tone = 'neutral',
  size = 'md',
  className = '',
  children,
  ...rest
}: { tone?: Tone; size?: Size; children: ReactNode } & HTMLAttributes<HTMLSpanElement>) {
  return (
    <span className={`inline-flex items-center rounded-full whitespace-nowrap ${SIZE[size]} ${TONE[tone]} ${className}`.trim()} {...rest}>
      {children}
    </span>
  );
}
