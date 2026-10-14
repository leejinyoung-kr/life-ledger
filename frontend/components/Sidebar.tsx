'use client';

/**
 * 데스크톱 좌측 메뉴 (232px). 글자 로고 · 묶음별 메뉴 · 아래 사용자 + 로그아웃.
 * 묶음(1차 메뉴)은 접혀 있고 누르면 항목(2차 메뉴)이 펼쳐진다. 지금 화면이 속한 묶음만 처음에 펼쳐 둔다.
 * 휴대폰에서는 숨기고 아래 메뉴 + '전체 메뉴' 시트(MoreSheet)가 대신한다.
 */
import { useState } from 'react';
import { useApiQuery } from '@/lib/query';
import { NAV, type NavSection } from '@/lib/nav';
import { useUnreadCount } from '@/lib/useUnreadCount';
import { IconCaret, IconLogout } from './icons';
import IconButton from './ui/IconButton';
import Wordmark from './Wordmark';

interface MeUser { name: string; email: string }

// 메뉴 줄 오른쪽 개수 배지 (안 읽은 알림)
function CountBadge({ count }: { count: number }) {
  return <span className="min-w-[18px] h-[18px] px-[5px] rounded-full bg-danger text-on-solid text-[0.68rem] leading-[18px] text-center">{count > 99 ? '99+' : count}</span>;
}

// 메뉴 한 줄 — 고른 메뉴는 둥근 옅은 초록 바탕 + 진한 초록 굵은 글자. sub 는 사이드바 2차 메뉴(들여 씀)
export function NavLink({ href, icon, label, active, count, size = 'md', sub, onClick }: { href: string; icon: React.ReactNode; label: string; active: boolean; count?: number; size?: 'md' | 'lg'; sub?: boolean; onClick?: () => void }) {
  return (
    <a
      href={href}
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={`flex items-center gap-2.5 rounded-ui transition-colors [&_svg]:shrink-0 ${sub ? 'pl-8 pr-2.5' : 'px-2.5'} ${size === 'lg' ? 'min-h-11 text-[0.94rem] [&_svg]:w-[19px] [&_svg]:h-[19px]' : 'min-h-9 text-[0.875rem] [&_svg]:w-[17px] [&_svg]:h-[17px]'} ${active ? 'bg-accent-dim text-accent-dark font-semibold' : 'text-secondary hover:bg-surface hover:text-primary'}`}
    >
      {icon}
      <span className="flex-1">{label}</span>
      {count ? <CountBadge count={count} /> : null}
    </a>
  );
}

// 로그인 사용자 줄 — 이니셜 · 이름 · 이메일(누르면 설정의 내 계정으로) + 오른쪽 동작(로그아웃). 로그아웃은 잘못 눌리지 않게 따로 둔다
export function UserLine({ children }: { children?: React.ReactNode }) {
  const me = useApiQuery<MeUser>(['auth', 'me'], '/auth/me').data ?? null;
  const name = me?.name || '사용자';
  return (
    <div className="flex items-center gap-1">
      <a href="/settings" title="내 계정 설정" className="flex-1 min-w-0 flex items-center gap-2.5 -ml-1.5 px-1.5 py-1 rounded-ui transition-colors hover:bg-surface">
        <span className="w-8 h-8 rounded-full bg-accent-dim text-accent-dark font-semibold grid place-items-center text-[0.8rem] shrink-0">{name.charAt(0)}</span>
        <span className="flex-1 min-w-0 flex flex-col leading-tight">
          <span className="text-[0.84rem] font-medium text-primary truncate">{name}</span>
          <span className="text-[0.75rem] text-muted truncate">{me?.email ?? ''}</span>
        </span>
      </a>
      {children}
    </div>
  );
}

// 1차 메뉴(묶음) 한 개 — 이름 줄을 누르면 2차 메뉴를 펼치거나 접는다. 접혀 있어도 안 읽은 알림 수는 이름 줄에 보인다
function NavGroup({ section, open, activePath, unread, onToggle, onPick }: {
  section: NavSection;
  open: boolean;
  activePath: string;
  unread: number;
  onToggle: () => void;
  onPick: () => void;
}) {
  const id = `nav-group-${section.label}`;
  const hasActive = section.items.some((it) => it.href === activePath);
  const groupCount = section.items.some((it) => it.badge === 'unread') ? unread : 0;
  return (
    <div className="flex flex-col">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={id}
        className={`flex items-center gap-2.5 px-2.5 min-h-9 rounded-ui text-[0.875rem] text-left transition-colors hover:bg-surface hover:text-primary [&_svg]:shrink-0 [&_svg]:w-[17px] [&_svg]:h-[17px] ${hasActive ? 'text-primary font-semibold' : 'text-secondary'}`}
      >
        {section.icon}
        <span className="flex-1">{section.label}</span>
        {!open && groupCount > 0 && <CountBadge count={groupCount} />}
        <IconCaret className={`text-muted transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>
      {/* grid-rows 0fr ↔ 1fr 로 높이를 몰라도 부드럽게 접고 편다. 접힌 동안은 inert 로 탭 이동에서 뺀다 */}
      <div id={id} inert={!open} className={`grid transition-[grid-template-rows] duration-200 ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
        <div className="overflow-hidden flex flex-col gap-px">
          {section.items.map((it) => (
            <NavLink key={it.href} sub href={it.href} icon={it.icon} label={it.label} active={activePath === it.href} count={it.badge === 'unread' ? unread : undefined} onClick={onPick} />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Sidebar({ activePath = '/dashboard', onLogout }: { activePath?: string; onLogout?: () => void }) {
  const unread = useUnreadCount();
  // 펼친 1차 메뉴 — 처음에는 지금 화면이 속한 묶음만
  const [openGroups, setOpenGroups] = useState<Set<string>>(
    () => new Set(NAV.filter((s) => s.label && s.items.some((it) => it.href === activePath)).map((s) => s.label)),
  );

  // 1차 메뉴 펼침/접힘 — 다른 묶음은 그대로 둔다
  const toggle = (label: string) => setOpenGroups((prev) => {
    const next = new Set(prev);
    if (next.has(label)) next.delete(label); else next.add(label);
    return next;
  });

  return (
    <aside className="w-[var(--sidebar-w)] h-screen bg-background border-r border-border flex flex-col fixed top-0 left-0 z-[100] max-md:hidden">
      <a href="/dashboard" className="h-[var(--header-h)] flex items-center px-5 border-b border-border shrink-0">
        <Wordmark />
      </a>

      <nav className="flex-1 overflow-y-auto px-2.5 py-3.5 flex flex-col gap-1" aria-label="주 메뉴">
        {NAV.map((section) => section.label ? (
          <NavGroup
            key={section.label}
            section={section}
            open={openGroups.has(section.label)}
            activePath={activePath}
            unread={unread}
            onToggle={() => toggle(section.label)}
            // 2차 메뉴를 고르면 그 묶음만 펼쳐 두고 나머지는 접는다
            onPick={() => setOpenGroups(new Set([section.label]))}
          />
        ) : (
          section.items.map((it) => (
            <NavLink key={it.href} href={it.href} icon={it.icon} label={it.label} active={activePath === it.href} count={it.badge === 'unread' ? unread : undefined} />
          ))
        ))}
      </nav>

      <div className="px-4 py-3.5 border-t border-border">
        <UserLine>
          <IconButton label="로그아웃" title="로그아웃" size="lg" onClick={onLogout}><IconLogout /></IconButton>
        </UserLine>
      </div>
    </aside>
  );
}
