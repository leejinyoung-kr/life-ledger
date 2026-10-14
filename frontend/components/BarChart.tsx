/**
 * 막대 차트 — 값 · 막대 · 이름표 영역을 나눠, 막대 높이가 실제 값 비율대로 그려진다(시안 점검 §3-1).
 * tone 은 막대의 뜻: out(지출 색) · neutral(글자색 계열). 이번 달(current) 막대만 진하게 칠한다.
 */
export type BarItem = { key: string; label: string; value: number; valueLabel?: string; current?: boolean };

const TONE = {
  out: { bar: 'bg-danger/25', current: 'bg-danger' },
  neutral: { bar: 'bg-primary/15', current: 'bg-primary/70' },
} as const;

export default function BarChart({ items, tone = 'neutral', height = 140, label }: {
  items: BarItem[];
  tone?: keyof typeof TONE;
  /** 막대 영역 높이(px) — 값 · 이름표 줄은 따로 */
  height?: number;
  /** 접근성 이름 */
  label: string;
}) {
  const max = Math.max(1, ...items.map((it) => it.value));
  return (
    <div role="img" aria-label={label} className="flex gap-2.5 items-end">
      {items.map((it) => (
        <div key={it.key} className="flex-1 min-w-0 flex flex-col items-center gap-1.5">
          <span className={`text-[0.7rem] h-4 leading-4 truncate max-w-full ${it.current ? 'text-primary' : 'text-muted'}`}>{it.valueLabel ?? ''}</span>
          <div className="w-full flex items-end" style={{ height }}>
            <div
              className={`w-full rounded-t-[2px] ${it.current ? TONE[tone].current : TONE[tone].bar}`}
              style={{ height: `${Math.max(2, Math.round((Math.max(0, it.value) / max) * 100))}%` }}
            />
          </div>
          <span className={`text-[0.72rem] ${it.current ? 'text-primary' : 'text-muted'}`}>{it.label}</span>
        </div>
      ))}
    </div>
  );
}
