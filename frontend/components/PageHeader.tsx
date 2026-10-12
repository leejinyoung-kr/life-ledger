/**
 * 페이지 맨 위 제목 블록 — 제목(h1) · 부제목 · 우측 액션 버튼.
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
  /** 제목 왼쪽 아이콘 (accent 색) */
  icon?: ReactNode;
}) {
  const heading = (
    <h1 className={`[font-family:var(--font-display)] text-[1.55rem] font-bold tracking-[-0.03em] text-primary${icon ? ' flex items-center gap-2.5' : ''}`}>
      {icon}
      {title}
    </h1>
  );

  return (
    <div className="mb-7">
      {actions ? (
        <div className="flex items-center justify-between gap-4">
          {heading}
          {actions}
        </div>
      ) : heading}
      {description && <p className="text-sm text-secondary mt-1.5 break-keep">{description}</p>}
    </div>
  );
}
