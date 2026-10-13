/**
 * 사용자 설정 기본값.
 * 설정 행이 없는 사용자에게 처음 만들어줄 값 + 시드가 함께 사용한다.
 */

// 카테고리 목록 (이모지 + 이름)
export const DEFAULT_CATEGORIES: { emoji: string; name: string }[] = [
  { emoji: '☕', name: '식비' },
  { emoji: '🚇', name: '교통' },
  { emoji: '📺', name: '구독' },
  { emoji: '🛒', name: '쇼핑' },
  { emoji: '💰', name: '급여' },
];
