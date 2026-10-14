/**
 * 목록 위 도구 줄 — 왼쪽 '총 n건', 오른쪽 선택삭제 · 개수 같은 동작.
 * PC 는 한 줄: 총 n건 · summary ······ tools · 동작.
 * 휴대폰은 첫 줄을 늘 '총 n건 ······ 동작' 으로 두고, summary(합계 · 안내) · tools(엑셀 · 통화)는 둘째 줄로 내린다.
 */
import type { ReactNode } from 'react';

// 목록 위 도구 줄
export default function ListToolbar({ total, unit = '건', summary, tools, className = '', children }: {
  total: number;
  unit?: string;
  /** 총 n건 옆 덧붙임 — 휴대폰은 둘째 줄 왼쪽 */
  summary?: ReactNode;
  /** 동작 앞 보조 도구 — 휴대폰은 둘째 줄 오른쪽 */
  tools?: ReactNode;
  className?: string;
  /** 오른쪽 동작 (선택삭제 · LimitSelect) */
  children: ReactNode;
}) {
  const second = !!(summary || tools);
  return (
    <div className={`flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 border-b border-border text-[0.8125rem] ${className}`.trim()}>
      <span className="order-1">총 <b className="font-semibold">{total}</b>{unit}</span>
      {summary && <div className="order-4 md:order-2 flex items-baseline gap-x-3.5 gap-y-1 flex-wrap min-w-0">{summary}</div>}
      {tools && <div className="order-5 md:order-3 ml-auto flex items-center gap-2">{tools}</div>}
      <div className={`order-2 md:order-4 ml-auto flex items-center gap-2 shrink-0 ${tools ? 'md:ml-0' : ''}`}>{children}</div>
      {/* 휴대폰에서 summary · tools 를 둘째 줄로 내리는 줄바꿈 */}
      {second && <span aria-hidden className="order-3 basis-full h-0 md:hidden" />}
    </div>
  );
}
