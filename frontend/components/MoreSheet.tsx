'use client';

/**
 * 휴대폰 · 태블릿 메뉴 서랍 — 아래 메뉴의 더보기를 누르면 왼쪽에서 나온다. 사이드바와 같은 안쪽(SideMenu)을 쓴다.
 * 아래 메뉴는 가리지 않아 더보기를 다시 눌러도 닫힌다. Esc · X · 바깥 누름으로 닫힌다(입력이 없는 메뉴라 바깥 누름도 허용).
 */
import { useEffect } from 'react';
import { IconClose } from './icons';
import IconButton from './ui/IconButton';
import { SideMenu } from './Sidebar';

export default function MoreSheet({ open, activePath, onClose, onLogout }: { open: boolean; activePath?: string; onClose: () => void; onLogout?: () => void }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="hidden max-lg:block fixed inset-x-0 top-0 bottom-[calc(60px+env(safe-area-inset-bottom))] z-[150] bg-backdrop [animation:fadeIn_0.15s_ease]" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="전체 메뉴"
        className="h-full w-[264px] max-w-[85vw] bg-background border-r border-border shadow-overlay flex flex-col [animation:slideInLeft_0.2s_ease]"
        onClick={(e) => e.stopPropagation()}
      >
        <SideMenu
          size="lg"
          activePath={activePath}
          onLogout={onLogout}
          onPick={onClose}
          headerAction={<IconButton label="닫기" size="lg" onClick={onClose}><IconClose /></IconButton>}
        />
      </div>
    </div>
  );
}
