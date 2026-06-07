/**
 * 공통 버튼 (Tailwind).
 * variant(primary/ghost/danger/solid-danger) + size(md/sm). href 를 주면 <a> 로 렌더된다.
 */
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'ghost' | 'danger' | 'solid-danger';
type Size = 'md' | 'sm';

const BASE =
  'inline-flex items-center justify-center gap-1.5 rounded-[var(--radius)] font-semibold whitespace-nowrap transition-all cursor-pointer [&_svg]:w-[15px] [&_svg]:h-[15px] disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none';

const VARIANT: Record<Variant, string> = {
  primary: 'bg-accent text-white hover:bg-accent-dark hover:shadow-[0_0_0_3px_var(--accent-dim)]',
  ghost: 'bg-transparent text-secondary border border-border font-medium hover:bg-surface hover:text-primary',
  danger: 'bg-danger-dim text-danger hover:bg-[rgba(240,68,56,0.15)]',
  'solid-danger': 'bg-danger text-white border border-danger font-semibold hover:bg-[#d32f1e] hover:border-[#d32f1e]',
};

const SIZE: Record<Size, string> = {
  md: 'px-4 py-2 text-[0.855rem]',
  sm: 'px-2.5 py-[5px] text-[0.78rem]',
};

// variant/size → 클래스 문자열 (다른 컴포넌트에서 a 태그 등에 직접 쓸 때 재사용)
export function buttonClasses(variant: Variant = 'primary', size: Size = 'md', extra = ''): string {
  return `${BASE} ${VARIANT[variant]} ${SIZE[size]} ${extra}`.trim();
}

type CommonProps = { variant?: Variant; size?: Size; className?: string; children: ReactNode };

type ButtonProps = CommonProps & ButtonHTMLAttributes<HTMLButtonElement> & { href?: undefined };
type LinkProps = CommonProps & AnchorHTMLAttributes<HTMLAnchorElement> & { href: string };

export default function Button(props: ButtonProps | LinkProps) {
  const { variant = 'primary', size = 'md', className = '', children, ...rest } = props;
  const cls = buttonClasses(variant, size, className);

  if ('href' in props && props.href !== undefined) {
    const { href, ...anchorRest } = rest as AnchorHTMLAttributes<HTMLAnchorElement> & { href: string };
    return <a href={href} className={cls} {...anchorRest}>{children}</a>;
  }
  return <button className={cls} {...(rest as ButtonHTMLAttributes<HTMLButtonElement>)}>{children}</button>;
}
