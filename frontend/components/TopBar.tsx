'use client';

/**
 * 공통 상단 바 (데스크톱 56 · 휴대폰 52).
 * 데스크톱: 통합 검색 상자 · 알림 종 · 테마. 휴대폰: 글자 로고 · 검색 · 종 · 테마 (44px 버튼).
 * 페이지 이름은 PageHeader 가 보여 주므로 여기서 되풀이하지 않는다.
 */
import { useEffect } from 'react';
import Link from 'next/link';
import { useQueryClient } from '@tanstack/react-query';
import GlobalSearch from './GlobalSearch';
import Wordmark from './Wordmark';
import IconButton from './ui/IconButton';
import { IconBell, IconMoon, IconSun } from './icons';
import { qk } from '@/lib/queryKeys';
import { useUnreadCount } from '@/lib/useUnreadCount';
import { useTheme } from '@/lib/useTheme';

export default function TopBar() {
  const qc = useQueryClient();
  const unread = useUnreadCount();
  const { dark, toggle } = useTheme();

  // 서비스워커가 푸시 수신 시 보내는 신호 → 미읽음 수/목록 즉시 갱신 (폴링 대기 없이 실시간)
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    const onMessage = (e: MessageEvent) => {
      if (e.data?.type === 'noti') qc.invalidateQueries({ queryKey: qk.notifications.all });
    };
    navigator.serviceWorker.addEventListener('message', onMessage);
    return () => navigator.serviceWorker.removeEventListener('message', onMessage);
  }, [qc]);

  return (
    <div className="h-[var(--header-h)] max-lg:h-[52px] border-b border-border flex items-center gap-2 pl-8 pr-6 max-lg:pl-4 max-lg:pr-1.5 max-lg:gap-0.5 bg-background sticky top-0 z-50">
      <Link href="/dashboard" className="hidden max-lg:block flex-1"><Wordmark /></Link>
      <GlobalSearch />
      <span className="flex-1 max-lg:hidden" />
      <IconButton href="/notifications" size="lg" label={unread ? `알림 ${unread}건` : '알림'}>
        <IconBell />
        {unread > 0 && (
          <>
            <span className="absolute top-1 right-1 min-w-[15px] h-[15px] px-1 rounded-full bg-danger text-on-solid text-[0.625rem] leading-[15px] text-center max-lg:hidden">{unread > 99 ? '99+' : unread}</span>
            <span className="hidden max-lg:block absolute top-2 right-2 w-[7px] h-[7px] rounded-full bg-danger" />
          </>
        )}
      </IconButton>
      <IconButton size="lg" onClick={toggle} label={dark ? '라이트 모드로 전환' : '다크 모드로 전환'}>
        {dark ? <IconSun /> : <IconMoon />}
      </IconButton>
    </div>
  );
}
