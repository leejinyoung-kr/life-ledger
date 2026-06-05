/**
 * 보안 센터 공통 타입 · 아이콘/배지 맵.
 * 백엔드 응답 DTO(/security)와 1:1 대응한다. 상대시각은 lib/notification 과 공유.
 */

export type RiskCategory = 'reuse' | 'weak' | 'no2fa' | 'breach';
export type RiskSeverity = 'critical' | 'danger' | 'warning' | 'info';
export type SessionDeviceType = 'desktop' | 'mobile' | 'unknown';
export type SessionStatus = 'active' | 'unverified';

export interface SecuritySummary {
  score: number;
  scoreLabel: string;
  gainIfResolved: number;
  riskCount: number;
  stats: { reuse: number; weak: number; no2fa: number; breach: number };
}

export interface SecurityRisk {
  id: number;
  category: RiskCategory;
  severity: RiskSeverity;
  title: string;
  description: string;
  actionLabel: string;
  href: string; // 조치 페이지 (실시간 분석 결과는 직접 해결 대신 해당 페이지로 이동)
}

export interface LoginSession {
  id: number;
  device: string;
  deviceType: SessionDeviceType;
  location: string;
  isCurrent: boolean;
  status: SessionStatus;
  lastActiveAt: string; // ISO
}

// 위험 종류 → 아이콘
export const RISK_CATEGORY_ICON: Record<RiskCategory, string> = {
  reuse: '🔁',
  weak: '⚠️',
  no2fa: '🔐',
  breach: '🚨',
};

// 심각도 → 배지(라벨/클래스) + 아이콘 톤
export const SEVERITY_BADGE: Record<RiskSeverity, { label: string; cls: string; tone: string }> = {
  critical: { label: '심각', cls: 'badge-danger', tone: 'danger' },
  danger: { label: '위험', cls: 'badge-danger', tone: 'danger' },
  warning: { label: '주의', cls: 'badge-warning', tone: 'warning' },
  info: { label: '권장', cls: 'badge-blue', tone: 'blue' },
};

// 요약 STATS 4칸 메타 (카테고리코드 → 카드 표시)
export const STAT_META: { key: RiskCategory; icon: string; tone: 'green' | 'red' | 'blue' | 'amber'; label: string; change: string }[] = [
  { key: 'reuse', icon: '🔁', tone: 'red', label: '재사용 비밀번호', change: '위험' },
  { key: 'weak', icon: '⚠️', tone: 'amber', label: '취약한 비밀번호', change: '8자 미만' },
  { key: 'no2fa', icon: '🔐', tone: 'blue', label: '2FA 미설정', change: '권장' },
  { key: 'breach', icon: '🚨', tone: 'red', label: '유출 의심', change: '즉시 변경' },
];

// 기기 종류 → 아이콘
export const DEVICE_ICON: Record<SessionDeviceType, string> = {
  desktop: '💻',
  mobile: '📱',
  unknown: '🖥️',
};

// 점수 라벨 → 게이지 색 변수
export const SCORE_COLOR: Record<string, string> = {
  양호: 'var(--success)',
  보통: 'var(--warning)',
  취약: 'var(--danger)',
};
