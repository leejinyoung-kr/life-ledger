/**
 * 설정 공통 타입 · 라벨/순서 맵.
 * 백엔드 응답 DTO(GET /settings)와 1:1 대응한다. 위젯 프레젠테이션 메타(아이콘 등)는
 * JSX 가 필요하므로 page.tsx 에 두고, 여기서는 데이터 형태만 다룬다.
 */

export interface SettingsUser {
  email: string;
  name: string;
  picture: string | null;
}

export interface Category {
  emoji: string;
  name: string;
}

export interface WidgetPref {
  id: string;
  on: boolean;
}

export interface Settings {
  user: SettingsUser;
  displayName: string;
  notifBudget: boolean;
  notifMonthly: boolean;
  notifUpload: boolean;
  sessionExpiry: string; // 7d|1d|12h|none
  pwAutoHide: string; // 10s|30s|1m|none
  claudeApiKeySet: boolean;
  claudeApiKeyMasked: string | null;
  claudeModel: string;
  budgets: Record<string, number>;
  categories: Category[];
  widgets: WidgetPref[];
}

// 예산 카테고리 코드 → 라벨 (렌더 순서 = 키 순서)
export const BUDGET_LABEL: Record<string, string> = {
  food: '식비',
  transport: '교통',
  subscription: '구독',
  shopping: '쇼핑',
  etc: '기타',
};

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

export const CLAUDE_MODEL_OPTIONS = ['claude-sonnet-4-6', 'claude-haiku-4-5'];
