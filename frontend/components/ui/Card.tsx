/**
 * 공통 카드 (Tailwind) — Card / CardHeader / CardTitle / CardBody.
 * CardBody 는 compact(상단 패딩 축소)·flush(패딩 제거) 옵션 지원.
 */
import type { HTMLAttributes, ReactNode } from 'react';
import { clickable } from '@/lib/a11y';

type CardHover = 'lift' | 'accent' | 'tile';
type CardTone = 'default' | 'accent' | 'danger';

// tone: accent 는 고른 카드(초록 테두리), danger 는 위험 구역(옅은 지출 색 테두리)
const TONE: Record<CardTone, string> = {
  default: 'border-border',
  accent: 'border-accent',
  danger: 'border-danger/35',
};

// hover: 누를 수 있는 카드는 테두리만 초록(lift · accent), tile 은 옅은 초록 바탕까지(폴더 타일)
const HOVER: Record<CardHover, string> = {
  lift: 'transition-colors hover:border-accent',
  accent: 'transition-colors hover:border-accent',
  tile: 'transition-colors hover:border-accent hover:bg-accent-dim',
};

// clip: 자식이 모서리 밖으로 나가지 않게 자른다. onClick 을 주면 키보드로도 누를 수 있는 클릭 카드가 되고 hover 기본값은 accent
export function Card({
  clip,
  hover,
  onClick,
  className = '',
  children,
  tone,
  ...rest
}: Omit<HTMLAttributes<HTMLDivElement>, 'onClick'> & { clip?: boolean; hover?: CardHover; onClick?: () => void; tone?: CardTone }) {
  const h = hover ?? (onClick ? 'accent' : undefined);
  const cls = [
    'border rounded-panel bg-background shadow-card',
    TONE[tone ?? 'default'],
    clip ? 'overflow-hidden' : '',
    onClick ? 'cursor-pointer' : '',
    h ? HOVER[h] : '',
    className,
  ].filter(Boolean).join(' ');
  return (
    <div className={cls} onClick={onClick} {...(onClick ? clickable(onClick) : {})} {...rest}>
      {children}
    </div>
  );
}

export function CardHeader({ className = '', children }: { className?: string; children: ReactNode }) {
  return (
    <div className={`flex items-center justify-between gap-3 px-[18px] py-3.5 border-b border-border-subtle ${className}`}>
      {children}
    </div>
  );
}

export function CardTitle({ children }: { children: ReactNode }) {
  return <span className="text-[1.0625rem] font-bold leading-tight text-primary flex items-center gap-2">{children}</span>;
}

// padding 기본 20px. compact=상단 8px, flush=0
export function CardBody({ compact, flush, className = '', children }: { compact?: boolean; flush?: boolean; className?: string; children: ReactNode }) {
  const pad = flush ? 'p-0' : compact ? 'px-5 pb-5 pt-2' : 'p-5';
  return <div className={`${pad} ${className}`}>{children}</div>;
}
