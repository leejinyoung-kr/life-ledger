'use client';

/**
 * 설정류 화면 공통 묶음 — 헤더가 있는 그룹 카드(SettingGroup)와 그 안의 행(SettingRow).
 * 설정 · 보안 화면이 같이 쓴다.
 */
import type { ReactNode } from 'react';
import { Card } from '@/components/ui/Card';

// 설정 그룹 (헤더 + 행 묶음)
export function SettingGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card clip>
      <div className="px-5 py-3.5 border-b border-border [font-family:var(--font-display)] font-bold text-[0.875rem] text-primary bg-surface">{title}</div>
      {children}
    </Card>
  );
}

// 설정 행 (라벨/설명 + 우측 컨트롤)
// stack: 컨트롤이 select/button 등으로 넓어 모바일에서 라벨과 줄바꿈이 필요한 행에만 true (기본은 토글류처럼 한 줄 유지)
export function SettingRow({ label, desc, labelClass, stack, children }: { label: string; desc?: string; labelClass?: string; stack?: boolean; children: ReactNode }) {
  return (
    <div className={`flex px-5 py-3.5 border-b border-border-subtle last:border-b-0 gap-6 ${stack ? 'flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between' : 'items-center justify-between'}`}>
      <div className={stack ? 'min-w-0' : 'flex-1 min-w-0'}>
        <div className={`text-[0.875rem] font-medium ${labelClass === 'danger' ? 'text-danger' : 'text-primary'}`}>{label}</div>
        {desc && <div className="text-[0.78rem] text-muted mt-0.5 break-keep">{desc}</div>}
      </div>
      <div className={`flex items-center gap-2.5 ${stack ? 'sm:shrink-0' : 'shrink-0'}`}>{children}</div>
    </div>
  );
}
