/**
 * 공통 카드 (Tailwind) — Card / CardHeader / CardTitle / CardBody.
 * CardBody 는 compact(상단 패딩 축소)·flush(패딩 제거) 옵션 지원.
 */
import type { HTMLAttributes, ReactNode } from 'react';
import { clickable } from '@/lib/a11y';

type CardHover = 'lift' | 'accent' | 'tile';

// hover: lift 은 살짝 뜨기(정보 카드), accent 는 테두리 강조(미리보기 카드), tile 은 배경 강조(폴더 타일)
const HOVER: Record<CardHover, string> = {
  lift: 'transition-all hover:shadow-[var(--shadow-md)] hover:-translate-y-px',
  accent: 'transition-all hover:border-accent hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)]',
  tile: 'transition-all hover:border-accent hover:bg-accent-dim hover:-translate-y-px',
};

// clip: 자식이 모서리 밖으로 나가지 않게 자른다. onClick 을 주면 키보드로도 누를 수 있는 클릭 카드가 되고 hover 기본값은 accent
export function Card({
  clip,
  hover,
  onClick,
  className = '',
  children,
  ...rest
}: Omit<HTMLAttributes<HTMLDivElement>, 'onClick'> & { clip?: boolean; hover?: CardHover; onClick?: () => void }) {
  const h = hover ?? (onClick ? 'accent' : undefined);
  const cls = [
    'bg-background border border-border rounded-[var(--radius-lg)] shadow-[var(--shadow-sm)]',
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
    <div className={`flex items-center justify-between px-5 pt-[18px] pb-[14px] border-b border-border ${className}`}>
      {children}
    </div>
  );
}

export function CardTitle({ children }: { children: ReactNode }) {
  return <span className="[font-family:var(--font-display)] text-[0.9rem] font-bold text-primary">{children}</span>;
}

// padding 기본 20px. compact=상단 8px, flush=0
export function CardBody({ compact, flush, className = '', children }: { compact?: boolean; flush?: boolean; className?: string; children: ReactNode }) {
  const pad = flush ? 'p-0' : compact ? 'px-5 pb-5 pt-2' : 'p-5';
  return <div className={`${pad} ${className}`}>{children}</div>;
}
