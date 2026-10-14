/**
 * 목록 위의 조회 조건 줄 (날짜 · 선택 · 검색 · 조회 버튼을 담는다). 바탕 상자 없이 위아래 선만.
 * className 은 바깥 간격용이다.
 */
import type { ReactNode } from 'react';

export default function FilterPanel({ className = 'mb-4', children }: { className?: string; children: ReactNode }) {
  return (
    <div className={`border-y border-border py-3 flex flex-col gap-3 ${className}`.trim()}>
      {children}
    </div>
  );
}
