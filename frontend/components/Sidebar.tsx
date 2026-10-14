'use client';

/**
 * 데스크톱 좌측 메뉴 (232px). 글자 로고 · 묶음별 메뉴 · 아래 사용자 + 로그아웃.
 * 휴대폰에서는 숨기고 아래 메뉴 + '전체 메뉴' 시트(MoreSheet)가 대신한다.
 */
import { useApiQuery } from '@/lib/query';
import { NAV } from '@/lib/nav';
import { useUnreadCount } from '@/lib/useUnreadCount';
import { IconLogout } from './icons';
import IconButton from './ui/IconButton';
import Wordmark from './Wordmark';

interface MeUser { name: string; email: string }

// 메뉴 한 줄 — 고른 메뉴는 왼쪽 금빛 선 + 옅은 금빛 바탕
export function NavLink({ href, icon, label, active, count, size = 'md' }: { href: string; icon: React.ReactNode; label: string; active: boolean; count?: number; size?: 'md' | 'lg' }) {
  return (
    <a
      href={href}
      aria-current={active ? 'page' : undefined}
      className={`flex items-center gap-2.5 px-2.5 border-l-2 rounded-r-ui transition-colors [&_svg]:shrink-0 ${size === 'lg' ? 'min-h-11 text-[0.94rem] [&_svg]:w-[19px] [&_svg]:h-[19px]' : 'min-h-9 text-[0.875rem] [&_svg]:w-[17px] [&_svg]:h-[17px]'} ${active ? 'border-accent bg-accent-dim text-accent-dark' : 'border-transparent text-primary hover:bg-surface'}`}
    >
      {icon}
      <span className="flex-1">{label}</span>
      {count ? <span className="min-w-[18px] h-[18px] px-[5px] rounded-full bg-danger text-on-solid text-[0.68rem] leading-[18px] text-center">{count > 99 ? '99+' : count}</span> : null}
    </a>
  );
}

// 로그인 사용자 줄 — 이니셜 · 이름 · 이메일
export function UserLine({ children }: { children?: React.ReactNode }) {
  const me = useApiQuery<MeUser>(['auth', 'me'], '/auth/me').data ?? null;
  const name = me?.name || '사용자';
  return (
    <div className="flex items-center gap-2.5">
      <span className="w-8 h-8 rounded-full border border-accent text-accent-dark grid place-items-center text-[0.8rem] shrink-0">{name.charAt(0)}</span>
      <div className="flex-1 min-w-0 flex flex-col leading-tight">
        <span className="text-[0.84rem] truncate">{name}</span>
        <span className="text-[0.75rem] text-muted truncate">{me?.email ?? ''}</span>
      </div>
      {children}
    </div>
  );
}

export default function Sidebar({ activePath = '/dashboard', onLogout }: { activePath?: string; onLogout?: () => void }) {
  const unread = useUnreadCount();
  return (
    <aside className="w-[var(--sidebar-w)] h-screen bg-page border-r border-border flex flex-col fixed top-0 left-0 z-[100] max-md:hidden">
      <a href="/dashboard" className="h-[var(--header-h)] flex items-center px-5 border-b border-border shrink-0">
        <Wordmark />
      </a>

      <nav className="flex-1 overflow-y-auto px-2.5 py-3.5 flex flex-col gap-3.5" aria-label="주 메뉴">
        {NAV.map((section) => (
          <div key={section.label || 'top'} className="flex flex-col gap-px">
            {section.label && <div className="text-[0.72rem] text-muted tracking-[0.06em] px-3 pb-1">{section.label}</div>}
            {section.items.map((it) => (
              <NavLink key={it.href} href={it.href} icon={it.icon} label={it.label} active={activePath === it.href} count={it.badge === 'unread' ? unread : undefined} />
            ))}
          </div>
        ))}
      </nav>

      <div className="px-4 py-3.5 border-t border-border">
        <UserLine>
          <IconButton label="로그아웃" size="lg" onClick={onLogout}><IconLogout /></IconButton>
        </UserLine>
      </div>
    </aside>
  );
}
