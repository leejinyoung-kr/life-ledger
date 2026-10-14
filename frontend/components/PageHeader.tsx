/**
 * 페이지 맨 위 제목 블록 — 제목(h1, 굵게 28) · 부제목 · 우측 액션 버튼.
 * 버튼은 늘 제목 줄 오른쪽에 두고, 부제목은 그 아래 줄을 꽉 쓴다 (부제목이 길어도 버튼이 아래로 밀리지 않게).
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
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 mb-7">
      <h1 className={`text-[1.75rem] max-md:text-[1.5rem] font-bold tracking-[-0.02em] leading-[1.2] text-primary${icon ? ' flex items-center gap-2.5 [&_svg]:text-accent' : ''}`}>
        {icon}
        {title}
      </h1>
      {actions && <div className="flex items-center justify-end gap-2">{actions}</div>}
      {description && <p className="col-span-2 text-[0.84rem] text-muted break-keep">{description}</p>}
    </div>
  );
}
