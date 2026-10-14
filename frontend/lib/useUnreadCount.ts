import { useApiQuery } from '@/lib/query';
import { qk } from '@/lib/queryKeys';

// 미읽음 알림 수 — 60초마다 폴링 + 알림 읽음/삭제 시 invalidate 로 갱신(상단바 · 사이드바 · 전체 메뉴가 같은 캐시를 본다)
export function useUnreadCount(): number {
  return useApiQuery<{ count: number }>(
    qk.notifications.unread(),
    '/notifications/unread-count',
    { refetchInterval: 60_000 },
  ).data?.count ?? 0;
}
