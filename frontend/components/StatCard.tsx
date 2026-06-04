/**
 * 공통 수치 요약 카드 (Tailwind).
 * 상단 아이콘 + 큰 수치 + 라벨 + 증감 표시로 구성. 대시보드/리포트 등에서 재사용한다.
 */
import type { ReactNode } from 'react';

interface StatCardProps {
  icon: ReactNode;
  /** 아이콘 배경 색상 톤 */
  tone: 'green' | 'red' | 'blue' | 'amber';
  value: string;
  /** 수치를 강조색(accent)으로 표시할지 */
  valueAccent?: boolean;
  label: string;
  change?: string;
  /** 증감 방향 — 색상 결정 */
  changeDir?: 'up' | 'down' | 'neutral';
}

const ICON_TONE: Record<StatCardProps['tone'], string> = {
  green: 'bg-accent-dim text-accent',
  red: 'bg-danger-dim text-danger',
  blue: 'bg-blue-dim text-blue',
  amber: 'bg-amber-dim text-amber',
};

const CHANGE_TONE: Record<NonNullable<StatCardProps['changeDir']>, string> = {
  up: 'text-accent',
  down: 'text-danger',
  neutral: 'text-muted font-normal',
};

export default function StatCard({
  icon, tone, value, valueAccent, label, change, changeDir = 'neutral',
}: StatCardProps) {
  return (
    <div className="bg-background border border-border rounded-[var(--radius-lg)] p-5 shadow-[var(--shadow-sm)] transition-all hover:shadow-[var(--shadow-md)] hover:-translate-y-px">
      <div className={`w-[38px] h-[38px] rounded-[var(--radius)] flex items-center justify-center mb-[14px] ${ICON_TONE[tone]}`}>
        {icon}
      </div>
      <div className={`[font-family:var(--font-display)] text-[1.75rem] font-bold tracking-[-0.04em] leading-none ${valueAccent ? 'text-accent' : 'text-primary'}`}>
        {value}
      </div>
      <div className="text-[0.78rem] text-secondary mt-[5px] font-medium">{label}</div>
      {change && <div className={`text-[0.75rem] mt-1.5 font-semibold ${CHANGE_TONE[changeDir]}`}>{change}</div>}
    </div>
  );
}
