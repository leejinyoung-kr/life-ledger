/**
 * 사용자 설정(UserSettings) 더미 — 1:1.
 * 기본값 + 표시이름을 채운다. user_id unique 라 기존 행 제거 후 재생성(idempotent).
 * 기본값은 src/settings/settings.defaults.ts 와 동일 — 시드 단독 실행을 위해 인라인 보관.
 */
import type { SeedFn } from './helpers';

const CATEGORIES = [
  { emoji: '☕', name: '식비' },
  { emoji: '🚇', name: '교통' },
  { emoji: '📺', name: '구독' },
  { emoji: '🛒', name: '쇼핑' },
  { emoji: '💰', name: '급여' },
];
const WIDGETS = [
  { id: 'stat-cards', on: true },
  { id: 'recent-activity', on: true },
  { id: 'quick-actions', on: true },
  { id: 'cred-count', on: false },
  { id: 'ai-summary', on: false },
];

// 한 사용자에게 설정 더미를 채운다 (기존 행 제거 후 재생성 → idempotent)
export const seedSettings: SeedFn = async (prisma, userId) => {
  await prisma.userSettings.deleteMany({ where: { user_id: userId } });
  await prisma.userSettings.create({
    data: {
      user_id: userId,
      display_name: '데모 사용자',
      notif_upload: false,
      session_expiry: '7d',
      pw_auto_hide: '10s',
      categories: CATEGORIES,
      widgets: WIDGETS,
    },
  });
  return 1;
};
