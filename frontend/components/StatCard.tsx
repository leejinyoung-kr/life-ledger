/**
 * 숫자 카드 — 따로 뜬 상자가 아니라 StatStrip 안에서 머리카락 선으로 나뉜 한 칸이다.
 * 금액 색은 돈의 뜻이 있을 때만 valueTone 으로 준다(수입 · 지출 · 자산이동). 그 밖의 금액은 글자색.
 */
import type { ReactNode } from 'react';

type Tone = 'green' | 'red' | 'blue' | 'amber';
type ValueTone = 'in' | 'out' | 'move';

interface StatCardProps {
  icon: ReactNode;
  /** 이름표 앞 아이콘 색 */
  tone: Tone;
  value: string;
  valueTone?: ValueTone;
  label: string;
  change?: string;
  changeDir?: 'up' | 'down' | 'neutral';
  /** 주면 칸 전체가 그 화면으로 가는 링크 */
  href?: string;
}

const ICON_TONE: Record<Tone, string> = {
  green: 'text-success',
  red: 'text-danger',
  blue: 'text-blue',
  amber: 'text-accent',
};

const VALUE_TONE: Record<ValueTone, string> = {
  in: 'text-success',
  out: 'text-danger',
  move: 'text-blue',
};

const CHANGE_TONE: Record<NonNullable<StatCardProps['changeDir']>, string> = {
  up: 'text-success',
  down: 'text-danger',
  neutral: 'text-muted',
};

export default function StatCard({ icon, tone, value, valueTone, label, change, changeDir = 'neutral', href }: StatCardProps) {
  const body = (
    <>
      <span className="text-[0.78rem] text-muted flex items-center gap-1.5">
        <span className={`inline-flex shrink-0 [&_svg]:w-3.25 [&_svg]:h-3.25 ${ICON_TONE[tone]}`}>{icon}</span>
        {label}
      </span>
      <span className={`text-[1.15rem] min-[480px]:text-[1.625rem] tracking-[-0.01em] leading-tight truncate ${valueTone ? VALUE_TONE[valueTone] : 'text-primary'}`}>
        {value}
      </span>
      {change && <span className={`text-[0.75rem] ${CHANGE_TONE[changeDir]}`}>{change}</span>}
    </>
  );
  const cls = 'bg-page px-[18px] py-4 flex flex-col gap-1 min-w-0';
  // href 가 있으면 칸 전체가 링크 — 띠 칸 높이를 다 채우고 hover 때 옅은 바탕
  if (href) return <a href={href} className={`${cls} transition-colors hover:bg-surface`}>{body}</a>;
  return <div className={cls}>{body}</div>;
}

// 숫자 카드 띠 — 넓은 화면은 한 줄, 좁으면 2열(홀수면 마지막 칸이 두 칸)
export function StatStrip({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-2 gap-px bg-border border border-border rounded-ui overflow-hidden mb-7 min-[1100px]:grid-flow-col min-[1100px]:auto-cols-fr [&>*:last-child:nth-child(odd)]:col-span-2 min-[1100px]:[&>*:last-child:nth-child(odd)]:col-span-1">
      {children}
    </div>
  );
}
