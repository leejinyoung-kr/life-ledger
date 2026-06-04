/**
 * 공통 배지 (Tailwind). tone 으로 색 구분.
 */
import type { ReactNode } from 'react';

type Tone = 'success' | 'warning' | 'danger' | 'neutral' | 'blue';

const TONE: Record<Tone, string> = {
  success: 'bg-accent-dim text-accent',
  warning: 'bg-warning-dim text-warning',
  danger: 'bg-danger-dim text-danger',
  neutral: 'bg-elevated text-secondary',
  blue: 'bg-blue-dim text-blue',
};

export default function Badge({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[0.72rem] font-semibold ${TONE[tone]}`}>
      {children}
    </span>
  );
}
