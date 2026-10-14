/**
 * 보안 화면 공통 타입 · 아이콘 맵.
 * 백엔드 응답 DTO(/security)와 1:1 대응한다. 상대시각은 lib/notification 과 공유.
 */
import type { ComponentType, SVGProps } from 'react';
import {
  IconMonitor, IconPhone, IconKey, IconShieldCheck, IconDoc, IconUnlock, IconLock, IconLogout, IconDownload,
} from '@/components/icons';

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

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

// 접근 감사 로그 동작 (백엔드 enum AccessAction 과 같다)
export type AccessAction =
  | 'cred_reveal' | 'cred_totp' | 'cred_backup' | 'backup_codes_generate'
  | 'vault_unlock' | 'vault_disable' | 'session_revoke' | 'data_export';

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
export const ACCESS_ACTION_META: Record<AccessAction, { label: string; Icon: IconComponent }> = {
  cred_reveal: { label: '비밀번호 열람', Icon: IconKey },
  cred_totp: { label: '2FA 코드 생성', Icon: IconShieldCheck },
  cred_backup: { label: '백업코드 열람', Icon: IconDoc },
  backup_codes_generate: { label: '백업코드 생성', Icon: IconDoc },
  vault_unlock: { label: '잠금 풀기', Icon: IconUnlock },
  vault_disable: { label: '마스터 잠금 해제', Icon: IconLock },
  session_revoke: { label: '기기 로그아웃', Icon: IconLogout },
  data_export: { label: '데이터 내보내기', Icon: IconDownload },
};

// 계정이 아닌 동작은 대상 이름에 내부 코드가 들어간다(vault · export:backup · all:3) → 읽을 수 있는 이름으로
export function accessTargetLabel(action: AccessAction, targetName: string): string {
  if (targetName === 'vault') return '마스터 잠금';
  if (targetName === 'export:backup') return '전체 백업 ZIP';
  if (targetName === 'export:credentials') return '계정 JSON';
  if (targetName === 'export:credentials-xlsx') return '계정 엑셀';
  if (action === 'session_revoke' && targetName.startsWith('all:')) return `다른 기기 ${targetName.slice(4)}대`;
  return targetName;
}

// 루프백 주소는 이 기기에서 접속한 것 — 화면에는 주소 대신 '이 기기'
export function accessIpLabel(ip: string): string {
  return ['::1', '127.0.0.1', '::ffff:127.0.0.1'].includes(ip) ? '이 기기' : ip;
}

// 기기 종류 → 아이콘
export const DEVICE_ICON: Record<SessionDeviceType, IconComponent> = {
  desktop: IconMonitor,
  mobile: IconPhone,
  unknown: IconMonitor,
};
