/**
 * 왼쪽 돋보기가 붙은 검색 입력칸. Enter 를 누르면 onEnter 가 불린다.
 * className 은 바깥 래퍼의 배치용(flex-1 · min-w 등)이다.
 */
import type { InputHTMLAttributes } from 'react';
import { IconSearch } from '../icons';

type SearchInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'aria-label' | 'type' | 'className'> & {
  label: string;
  onEnter?: () => void;
  className?: string;
};

export default function SearchInput({ label, onEnter, className = '', onKeyDown, ...rest }: SearchInputProps) {
  return (
    <div className={`relative ${className}`.trim()}>
      <IconSearch className="absolute left-2.75 top-1/2 -translate-y-1/2 text-muted w-3.75 h-3.75 pointer-events-none" />
      <input
        type="text"
        className="input pl-icon"
        aria-label={label}
        onKeyDown={(e) => {
          onKeyDown?.(e);
          if (e.key === 'Enter') onEnter?.();
        }}
        {...rest}
      />
    </div>
  );
}
