'use client';

/**
 * 모바일 전용 하단 내비게이션 (Tailwind). ≤768 에서만 노출.
 */
import { IconGrid, IconWon, IconFolder, IconMenu } from './icons';

interface BottomNavProps {
  activePath?: string;
  onMore?: () => void;
}

const NAV_ITEMS = [
  { label: '홈', href: '/dashboard', Icon: IconGrid },
  { label: '자산', href: '/transactions', Icon: IconWon },
  { label: '보관함', href: '/files', Icon: IconFolder },
];

const ITEM =
  'flex-1 flex flex-col items-center justify-center gap-[3px] text-[0.63rem] font-medium transition-colors bg-transparent border-none cursor-pointer no-underline rounded-ui px-1 py-1.5 [&>svg]:shrink-0';

export default function BottomNav({ activePath, onMore }: BottomNavProps) {
  return (
    <nav className="hidden max-md:flex fixed bottom-0 left-0 right-0 h-[60px] bg-background border-t border-border z-[100] px-1 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_16px_rgba(0,0,0,0.06)]">
      {NAV_ITEMS.map(({ label, href, Icon }) => (
        <a
          key={href}
          href={href}
          className={`${ITEM} ${activePath === href ? 'text-accent' : 'text-muted hover:text-secondary'}`}
        >
          <Icon width={22} height={22} />
          <span>{label}</span>
        </a>
      ))}
      <button type="button" className={`${ITEM} text-muted hover:text-secondary`} onClick={onMore} aria-label="더보기">
        <IconMenu width={22} height={22} />
        <span>더보기</span>
      </button>
    </nav>
  );
}
