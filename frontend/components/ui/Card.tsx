/**
 * 공통 카드 (Tailwind) — Card / CardHeader / CardTitle / CardBody.
 * CardBody 는 compact(상단 패딩 축소)·flush(패딩 제거) 옵션 지원.
 */
import type { ReactNode } from 'react';

export function Card({ className = '', children }: { className?: string; children: ReactNode }) {
  return (
    <div className={`bg-background border border-border rounded-[var(--radius-lg)] shadow-[var(--shadow-sm)] ${className}`}>
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
