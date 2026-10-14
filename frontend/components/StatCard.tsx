/**
 * 숫자 카드 — StatStrip 안에 나란히 놓이는 흰 카드 한 장. 위에 옅은 색 네모 아이콘 + 이름표, 아래 굵은 금액.
 * 금액 색은 돈의 뜻이 있을 때만 valueTone 으로 준다(수입 · 지출 · 자산이동 · 임박 경고). 그 밖의 숫자는 글자색.
 */
import type { ReactNode } from 'react';

type Tone = 'green' | 'red' | 'blue' | 'amber';
type ValueTone = 'in' | 'out' | 'move' | 'warn';

interface StatCardProps {
  icon: ReactNode;
  /** 아이콘 네모 색 */
  tone: Tone;
  value: string;
  valueTone?: ValueTone;
  label: string;
  change?: string;
  changeDir?: 'up' | 'down' | 'neutral';
}

const ICON_TONE: Record<Tone, string> = {
  green: 'bg-success-dim text-success',
  red: 'bg-danger-dim text-danger',
  blue: 'bg-blue-dim text-blue',
  amber: 'bg-amber-dim text-warning',
};

const VALUE_TONE: Record<ValueTone, string> = {
  in: 'text-success',
  out: 'text-danger',
  move: 'text-blue',
  warn: 'text-warning',
};

const CHANGE_TONE: Record<NonNullable<StatCardProps['changeDir']>, string> = {
  up: 'text-success',
  down: 'text-danger',
  neutral: 'text-muted',
};

export default function StatCard({ icon, tone, value, valueTone, label, change, changeDir = 'neutral' }: StatCardProps) {
  return (
    <div className="bg-background border border-border rounded-panel shadow-card px-5 py-4 flex flex-col gap-1 min-w-0">
      <span className="text-[0.84rem] text-secondary font-medium flex items-center gap-2 mb-1">
        <span className={`w-8 h-8 rounded-ui grid place-items-center shrink-0 [&_svg]:w-4 [&_svg]:h-4 ${ICON_TONE[tone]}`}>{icon}</span>
        {label}
      </span>
      {/* 휴대폰 2열에서는 카드 안쪽이 125px 안팎이라 8자리 금액(₩79,743,800)이 잘리지 않게 작게 */}
      <span className={`text-[1.05rem] min-[480px]:text-[1.625rem] font-bold tracking-[-0.02em] leading-tight truncate ${valueTone ? VALUE_TONE[valueTone] : 'text-primary'}`}>
        {value}
      </span>
      {change && <span className={`text-[0.75rem] ${CHANGE_TONE[changeDir]}`}>{change}</span>}
    </div>
  );
}

// 숫자 카드 줄 — 넓은 화면은 한 줄, 좁으면 2열(홀수면 마지막 카드가 두 칸)
export function StatStrip({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:gap-4 mb-7 min-[1100px]:grid-flow-col min-[1100px]:auto-cols-fr [&>*:last-child:nth-child(odd)]:col-span-2 min-[1100px]:[&>*:last-child:nth-child(odd)]:col-span-1">
      {children}
    </div>
  );
}
