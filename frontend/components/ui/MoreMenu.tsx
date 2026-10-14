'use client';

/**
 * 더보기 메뉴 — 표 관리 열 · 카드의 "자주 쓰는 하나 + 더보기" 규칙에서 나머지 동작(복사 · 삭제 등)을 담는다.
 * 표의 가로 스크롤 상자에 잘리지 않도록 body 에 고정 위치로 띄운다. Esc · 바깥 누름 · 고르면 닫힌다.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { IconMore } from '../icons';
import IconButton from './IconButton';

export type MoreMenuItem = { label: string; icon?: ReactNode; onSelect: () => void; danger?: boolean; disabled?: boolean };

export default function MoreMenu({ items, label = '더보기', size = 'md' }: { items: MoreMenuItem[]; label?: string; size?: 'md' | 'lg' }) {
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  const btnRef = useRef<HTMLSpanElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // 버튼 아래 오른쪽 맞춤으로 연다 (화면 아래가 모자라면 위로)
  function open() {
    const r = btnRef.current?.getBoundingClientRect();
    if (!r) return;
    const height = items.length * 40 + 8;
    const top = r.bottom + 4 + height > window.innerHeight ? Math.max(8, r.top - 4 - height) : r.bottom + 4;
    setPos({ top, right: window.innerWidth - r.right });
  }

  useEffect(() => {
    if (!pos) return;
    const close = () => setPos(null);
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    const onDown = (e: MouseEvent) => { if (!menuRef.current?.contains(e.target as Node)) close(); };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    menuRef.current?.querySelector<HTMLElement>('button:not([disabled])')?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [pos]);

  return (
    <>
      <span ref={btnRef} className="inline-flex" onClick={(e) => e.stopPropagation()}>
        <IconButton label={label} size={size} aria-haspopup="menu" aria-expanded={!!pos} onClick={() => (pos ? setPos(null) : open())}>
          <IconMore />
        </IconButton>
      </span>
      {pos && createPortal(
        <div
          ref={menuRef}
          role="menu"
          className="fixed z-[350] min-w-[150px] py-1 bg-background border border-border rounded-ui shadow-raised"
          style={{ top: pos.top, right: pos.right }}
          onClick={(e) => e.stopPropagation()}
        >
          {items.map((it) => (
            <button
              key={it.label}
              type="button"
              role="menuitem"
              disabled={it.disabled}
              className={`w-full flex items-center gap-2.5 px-3 h-10 text-left text-[0.84rem] transition-colors disabled:opacity-45 [&_svg]:w-4 [&_svg]:h-4 ${it.danger ? 'text-danger hover:bg-danger-dim' : 'text-primary hover:bg-surface'}`}
              onClick={() => { setPos(null); it.onSelect(); }}
            >
              {it.icon}{it.label}
            </button>
          ))}
        </div>,
        document.body,
      )}
    </>
  );
}
