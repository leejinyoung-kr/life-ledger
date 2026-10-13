/**
 * 보안 화면 공통 타입 · 아이콘 맵.
 * 백엔드 응답 DTO(/security)와 1:1 대응한다. 상대시각은 lib/notification 과 공유.
 */

export type SessionDeviceType = 'desktop' | 'mobile' | 'unknown';
export type SessionStatus = 'active' | 'unverified';

export interface LoginSession {
  id: number;
  device: string;
  deviceType: SessionDeviceType;
  location: string;
  isCurrent: boolean;
  status: SessionStatus;
  lastActiveAt: string; // ISO
}

// 접근 감사 로그 동작
export type AccessAction = 'cred_reveal' | 'cred_totp' | 'cred_backup';

export interface AccessLogEntry {
  id: number;
  action: AccessAction;
  targetType: string;
  targetId: number;
  targetName: string;
  ip: string | null;
  userAgent: string | null;
  at: string; // ISO
}

export interface VaultStatus {
  enabled: boolean;
  timeoutMin: number;
}

// 접근 동작 → 라벨/아이콘
export const ACCESS_ACTION_META: Record<AccessAction, { label: string; icon: string }> = {
  cred_reveal: { label: '비밀번호 열람', icon: '🔑' },
  cred_totp: { label: '2FA 코드 생성', icon: '🔢' },
  cred_backup: { label: '백업코드 열람', icon: '🧾' },
};

// 기기 종류 → 아이콘
export const DEVICE_ICON: Record<SessionDeviceType, string> = {
  desktop: '💻',
  mobile: '📱',
  unknown: '🖥️',
};
