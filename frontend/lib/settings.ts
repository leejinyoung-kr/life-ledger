/**
 * 설정 공통 타입 · 선택지 라벨.
 * 백엔드 응답 DTO(GET /settings)와 1:1 대응한다.
 */

export interface SettingsUser {
  email: string;
  name: string;
  picture: string | null;
  google: boolean; // 구글 계정과 연결됐는지 (이메일 인증코드로만 만든 계정은 false)
}

export interface Category {
  emoji: string;
  name: string;
}

export interface Settings {
  user: SettingsUser;
  displayName: string;
  notifUpload: boolean;
  notifMaturity: boolean;
  notifDeadline: boolean;
  showHolidays: boolean;
  sessionExpiry: string; // 7d|1d|12h|none
  pwAutoHide: string; // 10s|30s|1m|none
  categories: Category[];
}

export const SESSION_EXPIRY_OPTIONS: { value: string; label: string }[] = [
  { value: '7d', label: '7일' },
  { value: '1d', label: '1일' },
  { value: '12h', label: '12시간' },
  { value: 'none', label: '없음' },
];

export const PW_AUTO_HIDE_OPTIONS: { value: string; label: string }[] = [
  { value: '10s', label: '10초' },
  { value: '30s', label: '30초' },
  { value: '1m', label: '1분' },
  { value: 'none', label: '없음' },
];
