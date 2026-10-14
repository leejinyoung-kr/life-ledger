/**
 * 공통 아이콘 버튼 (Tailwind). label 은 접근성 이름이라 필수.
 * variant 로 모양, size 로 크기를 정한다 — className 은 배치용으로만 쓴다.
 * href 를 주면 Next Link 로 렌더된다(상단바 알림 종처럼 이동하는 아이콘 — 새로 불러오지 않고 화면만 바꾼다). 개수 점 등은 children 안에 absolute 로 얹는다.
 */
import Link from 'next/link';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'ghost' | 'bordered' | 'danger' | 'handle' | 'overlay';
type Size = 'md' | 'lg' | 'card';

const BASE = 'relative inline-flex items-center justify-center shrink-0 transition-all cursor-pointer';

// ghost: 행 안 보조 동작 · 상단바 / bordered: 수정·닫기 등 / danger: 삭제 / handle: 드래그 핸들 / overlay: 색 카드 위
// 올렸을 때 ghost · bordered 는 초록, danger 는 빨강 — 삭제만 눈에 띄지 않게 모든 동작이 색으로 반응한다
const VARIANT: Record<Variant, string> = {
  ghost: 'text-muted hover:bg-accent-dim hover:text-accent-dark',
  bordered: 'text-secondary border border-border hover:bg-accent-dim hover:text-accent-dark hover:border-accent',
  danger: 'text-muted hover:bg-danger-dim hover:text-danger',
  handle: 'text-muted cursor-grab touch-none hover:bg-hover hover:text-secondary active:cursor-grabbing',
  overlay: 'bg-white/[0.18] text-white hover:bg-white/[0.32]',
};

// md: 목록 행 30 / lg: 모달 · 상단바 36 (휴대폰 44) / card: 색 카드 위 오버레이
const SIZE: Record<Size, string> = {
  md: 'w-[30px] h-[30px] rounded-ui [&_svg]:w-4 [&_svg]:h-4',
  lg: 'w-9 h-9 rounded-ui [&_svg]:w-[18px] [&_svg]:h-[18px] max-md:w-11 max-md:h-11 max-md:[&_svg]:w-5 max-md:[&_svg]:h-5',
  card: 'w-[30px] h-[30px] rounded-md',
};

type IconButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label' | 'children'> & {
  label: string;
  variant?: Variant;
  size?: Size;
  /** 주면 링크(<a>)로 렌더 */
  href?: string;
  children: ReactNode;
};

export default function IconButton({ label, variant = 'ghost', size = 'md', href, className = '', type = 'button', children, ...rest }: IconButtonProps) {
  const cls = `${BASE} ${VARIANT[variant]} ${SIZE[size]} ${className}`.trim();
  if (href !== undefined) {
    return <Link href={href} aria-label={label} className={cls}>{children}</Link>;
  }
  return (
    <button type={type} aria-label={label} className={cls} {...rest}>
      {children}
    </button>
  );
}
