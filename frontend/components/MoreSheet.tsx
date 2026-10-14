'use client';

/**
 * 휴대폰 '전체 메뉴' 시트 — 아래 메뉴의 더보기를 누르면 아래에서 올라온다. 사이드바와 같은 메뉴 정의(NAV)를 쓴다.
 * Esc · X · 바깥 누름으로 닫힌다(입력이 없는 메뉴라 바깥 누름도 허용).
 */
import { useEffect } from 'react';
import { NAV } from '@/lib/nav';
import { useUnreadCount } from '@/lib/useUnreadCount';
import { IconClose, IconLogout } from './icons';
import IconButton from './ui/IconButton';
import Button from './ui/Button';
import { NavLink, UserLine } from './Sidebar';

export default function MoreSheet({ open, activePath, onClose, onLogout }: { open: boolean; activePath?: string; onClose: () => void; onLogout?: () => void }) {
  const unread = useUnreadCount();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="hidden max-md:flex fixed inset-0 z-[150] bg-backdrop items-end [animation:fadeIn_0.15s_ease]" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="전체 메뉴"
        className="w-full max-h-[80vh] overflow-y-auto bg-background rounded-t-xl px-3 pt-2 pb-[calc(80px+env(safe-area-inset-bottom))] flex flex-col gap-3 [animation:slideUp_0.2s_ease]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-1 py-1.5">
          <span className="[font-family:var(--font-display)] font-semibold text-[1.1875rem]">전체 메뉴</span>
          <IconButton label="닫기" size="lg" onClick={onClose}><IconClose /></IconButton>
        </div>
        {NAV.map((section) => (
          <div key={section.label || 'top'} className="flex flex-col">
            {section.label && <div className="text-[0.72rem] text-muted tracking-[0.06em] px-2 pb-0.5">{section.label}</div>}
            {section.items.map((it) => (
              <NavLink key={it.href} size="lg" href={it.href} icon={it.icon} label={it.label} active={activePath === it.href} count={it.badge === 'unread' ? unread : undefined} />
            ))}
          </div>
        ))}
        <div className="px-2 pt-3 border-t border-border">
          <UserLine>
            <Button variant="ghost" onClick={onLogout}><IconLogout />로그아웃</Button>
          </UserLine>
        </div>
      </div>
    </div>
  );
}
