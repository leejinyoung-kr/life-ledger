/**
 * 공통 수치 요약 카드.
 * 상단 아이콘 + 큰 수치 + 라벨 + 증감 표시로 구성. 대시보드/리포트 등에서 재사용한다.
 */
import type { ReactNode } from 'react';

interface StatCardProps {
  icon: ReactNode;
  /** 아이콘 배경 색상 톤 */
  tone: 'green' | 'red' | 'blue' | 'amber';
  value: string;
  /** 수치를 강조색(green)으로 표시할지 */
  valueAccent?: boolean;
  label: string;
  change?: string;
  /** 증감 방향 — 색상 결정 */
  changeDir?: 'up' | 'down' | 'neutral';
}

export default function StatCard({
  icon, tone, value, valueAccent, label, change, changeDir = 'neutral',
}: StatCardProps) {
  return (
    <div className="stat-card">
      <div className={`stat-icon ${tone}`}>{icon}</div>
      <div className={`stat-value${valueAccent ? ' green' : ''}`}>{value}</div>
      <div className="stat-label">{label}</div>
      {change && <div className={`stat-change ${changeDir}`}>{change}</div>}
    </div>
  );
}
