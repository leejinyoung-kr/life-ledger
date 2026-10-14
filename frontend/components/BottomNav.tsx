'use client';

/**
 * 휴대폰 아래 메뉴 5칸 — 홈 · 가계부 · 계정 · 일정 · 더보기(전체 메뉴 시트). ≤768 에서만 보인다.
 * 고른 칸은 위쪽 초록 선 + 진한 초록 글자.
 */
import { BOTTOM_NAV } from '@/lib/nav';

const ITEM = 'flex flex-col items-center justify-center gap-[3px] text-[0.6875rem] transition-colors [&_svg]:w-5 [&_svg]:h-5';

export default function BottomNav({ activePath, moreOpen, onMore }: { activePath?: string; moreOpen?: boolean; onMore?: () => void }) {
  return (
    <nav className="hidden max-md:grid grid-cols-5 fixed bottom-0 left-0 right-0 h-[calc(60px+env(safe-area-inset-bottom))] pb-[env(safe-area-inset-bottom)] bg-background border-t border-border z-[100]" aria-label="아래 메뉴">
      {BOTTOM_NAV.map((it) => {
        if (it.href === null) {
          return (
            <button key="more" type="button" onClick={onMore} aria-expanded={moreOpen} className={`${ITEM} ${moreOpen ? 'text-accent-dark shadow-[inset_0_2px_0_var(--accent)]' : 'text-muted'}`}>
              {it.icon}{it.label}
            </button>
          );
        }
        const on = activePath === it.href && !moreOpen;
        return (
          <a key={it.href} href={it.href} aria-current={on ? 'page' : undefined} className={`${ITEM} ${on ? 'text-accent-dark shadow-[inset_0_2px_0_var(--accent)]' : 'text-muted'}`}>
            {it.icon}{it.label}
          </a>
        );
      })}
    </nav>
  );
}
