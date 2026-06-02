'use client';

import { IconGrid, IconWon, IconFolder, IconChat, IconMenu } from './icons';

interface BottomNavProps {
  activePath?: string;
  onMore?: () => void;
}

const NAV_ITEMS = [
  { label: '홈', href: '/dashboard', Icon: IconGrid },
  { label: '가계부', href: '/transactions', Icon: IconWon },
  { label: '보관함', href: '/files', Icon: IconFolder },
  { label: 'AI챗', href: '/assistant', Icon: IconChat },
];

export default function BottomNav({ activePath, onMore }: BottomNavProps) {
  return (
    <nav className="bottom-nav">
      {NAV_ITEMS.map(({ label, href, Icon }) => (
        <a
          key={href}
          href={href}
          className={`bottom-nav-item${activePath === href ? ' active' : ''}`}
        >
          <Icon width={22} height={22} />
          <span>{label}</span>
        </a>
      ))}
      <button
        type="button"
        className="bottom-nav-item"
        onClick={onMore}
        aria-label="더보기"
      >
        <IconMenu width={22} height={22} />
        <span>더보기</span>
      </button>
    </nav>
  );
}
