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
  notifMonthly: boolean;
  notifUpload: boolean;
  notifMaturity: boolean;
  notifDeadline: boolean;
  showHolidays: boolean;
  sessionExpiry: string; // 7d|1d|12h|none
  pwAutoHide: string; // 10s|30s|1m|none
  openaiApiKeySet: boolean;
  openaiApiKeyMasked: string | null;
  openaiModel: string;
  categories: Category[];
  widgets: WidgetPref[];
  menuOrder: string[] | null; // 사이드바 1차 메뉴 순서 (key 배열). null=기본
}

// 사이드바 1차 메뉴 키 ↔ 라벨 (기본 순서 = 배열 순서). Sidebar·설정 공유
export const MENU_ITEMS: { key: string; label: string }[] = [
  { key: 'dashboard', label: '대시보드' },
  { key: 'finance', label: '금융' },
  { key: 'vault', label: '보관함' },
  { key: 'tools', label: '도구' },
  { key: 'insight', label: '인사이트' },
  { key: 'system', label: '시스템' },
];
export const DEFAULT_MENU_ORDER = MENU_ITEMS.map((m) => m.key);

// 저장된 순서를 기본 순서에 맞춰 정규화 — 알 수 없는 키 제거 + 누락 키는 기본 위치로 보강
export function normalizeMenuOrder(order: string[] | null | undefined): string[] {
  const valid = (order ?? []).filter((k) => DEFAULT_MENU_ORDER.includes(k));
  const missing = DEFAULT_MENU_ORDER.filter((k) => !valid.includes(k));
  return [...valid, ...missing];
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

export const OPENAI_MODEL_OPTIONS = ['gpt-4o-mini', 'gpt-4o'];

// 이번 달 AI 사용량 집계 (GET /ai/usage)
export interface AiUsageByModel {
  model: string;
  calls: number;
  totalTokens: number;
  costUsd: number;
}
export interface AiUsageSummary {
  month: string; // YYYY-MM
  calls: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costUsd: number;
  lastUsedAt: string | null;
  byModel: AiUsageByModel[];
}
