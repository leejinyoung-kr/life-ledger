/**
 * 막대 차트 — 값 · 막대 · 이름표 영역을 나눠, 막대 높이가 실제 값 비율대로 그려진다(시안 점검 §3-1).
 * tone 은 이번 달(current) 막대의 뜻: out(지출 색) · neutral(강조색 초록 — 순자산처럼 부호 없는 값). 지난 막대는 모두 옅은 회색이다.
 */
import type { ReactNode } from 'react';

// delta: 이름표 아래 증감 줄(▲▼ + 돈 색 글자) — 한 항목이라도 있으면 모든 막대에 줄 자리를 둔다
export type BarItem = { key: string; label: string; value: number; valueLabel?: string; current?: boolean; delta?: ReactNode };

const TONE = {
  out: { bar: 'bg-primary/12', current: 'bg-danger' },
  neutral: { bar: 'bg-primary/12', current: 'bg-accent' },
} as const;

export default function BarChart({ items, tone = 'neutral', height = 140, label }: {
  items: BarItem[];
  tone?: keyof typeof TONE;
  /** 막대 영역 높이(px) — 값 · 이름표 줄은 따로. 'fill' 이면 부모 높이를 꽉 채운다(부모에 높이가 있어야 한다) */
  height?: number | 'fill';
  /** 접근성 이름 */
  label: string;
}) {
  const max = Math.max(1, ...items.map((it) => it.value));
  const hasDelta = items.some((it) => it.delta != null);
  const fill = height === 'fill';
  return (
    <div role="img" aria-label={label} className={`flex gap-2.5 items-end justify-around ${fill ? 'h-full' : ''}`}>
      {items.map((it) => (
        <div key={it.key} className={`flex-1 min-w-0 max-w-24 flex flex-col items-center gap-1.5 ${fill ? 'h-full' : ''}`}>
          <span className={`text-[0.7rem] h-4 leading-4 truncate max-w-full ${it.current ? 'text-primary font-semibold' : 'text-muted'}`}>{it.valueLabel ?? ''}</span>
          <div className={`w-full flex items-end ${fill ? 'flex-1 min-h-0' : ''}`} style={fill ? undefined : { height }}>
            <div
              className={`w-full rounded-t-md ${it.current ? TONE[tone].current : TONE[tone].bar}`}
              style={{ height: `${Math.max(2, Math.round((Math.max(0, it.value) / max) * 100))}%` }}
            />
          </div>
          <span className={`text-[0.72rem] ${it.current ? 'text-primary' : 'text-muted'}`}>{it.label}</span>
          {hasDelta && <span className="text-[0.72rem] min-h-4 tabular-nums">{it.delta}</span>}
        </div>
      ))}
    </div>
  );
}
