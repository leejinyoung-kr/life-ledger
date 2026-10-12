import type { ReactNode, CSSProperties } from 'react';

interface StatCardProps {
  icon: ReactNode;
  tone: 'green' | 'red' | 'blue' | 'amber';
  value: string;
  valueAccent?: boolean;
  label: string;
  change?: string;
  changeDir?: 'up' | 'down' | 'neutral';
}

const ICON_TONE: Record<StatCardProps['tone'], string> = {
  green: 'bg-accent-dim text-accent',
  red:   'bg-danger-dim text-danger',
  blue:  'bg-blue-dim text-blue',
  amber: 'bg-amber-dim text-amber',
};

const CARD_STYLE: Record<StatCardProps['tone'], CSSProperties> = {
  green: { background: 'linear-gradient(135deg, var(--accent-dim) 0%, var(--background) 55%)' },
  red:   { background: 'linear-gradient(135deg, var(--danger-dim) 0%, var(--background) 55%)' },
  blue:  { background: 'linear-gradient(135deg, var(--blue-dim) 0%, var(--background) 55%)' },
  amber: { background: 'linear-gradient(135deg, var(--amber-dim) 0%, var(--background) 55%)' },
};

const ACCENT_BAR: Record<StatCardProps['tone'], CSSProperties> = {
  green: { background: 'var(--accent)' },
  red:   { background: 'var(--danger)' },
  blue:  { background: 'var(--blue)' },
  amber: { background: 'var(--amber)' },
};

const CHANGE_TONE: Record<NonNullable<StatCardProps['changeDir']>, string> = {
  up:      'text-accent',
  down:    'text-danger',
  neutral: 'text-muted font-normal',
};

export default function StatCard({
  icon, tone, value, valueAccent, label, change, changeDir = 'neutral',
}: StatCardProps) {
  return (
    <div
      className="relative border border-border rounded-panel p-5 shadow-card transition-all hover:shadow-raised hover:-translate-y-px overflow-hidden"
      style={CARD_STYLE[tone]}
    >
      <div className="absolute top-0 left-0 right-0 h-[3px] rounded-t-panel" style={ACCENT_BAR[tone]} />
      <div className={`w-[38px] h-[38px] rounded-ui flex items-center justify-center mb-[14px] ${ICON_TONE[tone]}`}>
        {icon}
      </div>
      <div className={`[font-family:var(--font-display)] text-[1.25rem] min-[480px]:text-[1.55rem] min-[1100px]:text-[1.75rem] font-bold tracking-[-0.04em] leading-none ${valueAccent ? 'text-accent' : 'text-primary'}`}>
        {value}
      </div>
      <div className="text-[0.78rem] text-secondary mt-[5px] font-medium">{label}</div>
      {change && <div className={`text-[0.75rem] mt-1.5 font-semibold ${CHANGE_TONE[changeDir]}`}>{change}</div>}
    </div>
  );
}
