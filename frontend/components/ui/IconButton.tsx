/**
 * 공통 아이콘 버튼 (Tailwind). label 은 접근성 이름이라 필수.
 * variant 로 모양, size 로 크기를 정한다 — className 은 배치용으로만 쓴다.
 */
import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'ghost' | 'bordered' | 'danger' | 'handle' | 'overlay';
type Size = 'md' | 'lg' | 'card';

const BASE = 'inline-flex items-center justify-center shrink-0 transition-all cursor-pointer';

// ghost: 행 안 보조 동작 / bordered: 수정·닫기 등 / danger: 삭제 / handle: 드래그 핸들 / overlay: 색 카드 위
const VARIANT: Record<Variant, string> = {
  ghost: 'text-muted hover:bg-surface hover:text-primary',
  bordered: 'text-secondary border border-border hover:bg-surface hover:text-primary',
  danger: 'text-muted hover:bg-danger-dim hover:text-danger',
  handle: 'text-muted cursor-grab touch-none hover:bg-surface hover:text-secondary active:cursor-grabbing',
  overlay: 'bg-white/[0.18] text-white hover:bg-white/[0.32]',
};

// md: 목록 행 / lg: 모달·툴바 상단 / card: 색 카드 위 오버레이
const SIZE: Record<Size, string> = {
  md: 'w-[30px] h-[30px] rounded-ui [&_svg]:w-4 [&_svg]:h-4',
  lg: 'w-9 h-9 rounded-ui [&_svg]:w-[18px] [&_svg]:h-[18px] max-md:w-11 max-md:h-11',
  card: 'w-[30px] h-[30px] rounded-md',
};

type IconButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label' | 'children'> & {
  label: string;
  variant?: Variant;
  size?: Size;
  children: ReactNode;
};

export default function IconButton({ label, variant = 'ghost', size = 'md', className = '', type = 'button', children, ...rest }: IconButtonProps) {
  return (
    <button type={type} aria-label={label} className={`${BASE} ${VARIANT[variant]} ${SIZE[size]} ${className}`.trim()} {...rest}>
      {children}
    </button>
  );
}
