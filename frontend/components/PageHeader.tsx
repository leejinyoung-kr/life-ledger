/**
 * 페이지 맨 위 제목 블록 — 제목(h1, 굵게 28) · 부제목 · 우측 액션 버튼.
 * 제목 모양을 한곳에 두려고 페이지에서 h1 을 직접 쓰지 않는다.
 */
import type { ReactNode } from 'react';

export default function PageHeader({
  title,
  description,
  actions,
  icon,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  /** 제목 왼쪽 아이콘 (초록) */
  icon?: ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-4 flex-wrap mb-7">
      <div className="flex flex-col gap-1 min-w-0">
        <h1 className={`text-[1.75rem] max-md:text-[1.5rem] font-bold tracking-[-0.02em] leading-[1.2] text-primary${icon ? ' flex items-center gap-2.5 [&_svg]:text-accent' : ''}`}>
          {icon}
          {title}
        </h1>
        {description && <p className="text-[0.84rem] text-muted break-keep">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
    </div>
  );
}
