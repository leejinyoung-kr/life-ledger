/**
 * 공통 버튼 (Tailwind).
 * variant(primary/ghost/danger/solid-danger/link) + size(md/sm/lg/inline). href 를 주면 <a> 로 렌더된다.
 * link + inline 은 글줄 안에 들어가는 링크 모양(브레드크럼 · 위치 표시)이다.
 * loading 이면 비활성화되고 children 대신 loadingLabel 을 보여준다.
 */
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'ghost' | 'danger' | 'solid-danger' | 'link';
type Size = 'md' | 'sm' | 'lg' | 'inline';

const BASE =
  'inline-flex items-center justify-center gap-1.5 rounded-ui font-semibold whitespace-nowrap transition-all cursor-pointer [&_svg]:w-[15px] [&_svg]:h-[15px] disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none';

const VARIANT: Record<Variant, string> = {
  // 주 버튼은 채우지 않고 금빛 테두리 + 진한 금빛 글자 (판정 D2 — 금빛 글자는 대비가 모자라다)
  primary: 'bg-accent-dim text-accent-dark border border-accent hover:bg-accent-hover',
  ghost: 'bg-transparent text-secondary border border-border font-medium hover:bg-surface hover:text-primary',
  danger: 'bg-danger-dim text-danger hover:bg-danger/15',
  'solid-danger': 'bg-danger text-on-solid border border-danger font-semibold hover:bg-danger-dark hover:border-danger-dark',
  link: 'bg-transparent text-accent-dark font-medium hover:opacity-70',
};

const SIZE: Record<Size, string> = {
  md: 'px-4 py-2 text-[0.855rem]',
  sm: 'px-2.5 py-[5px] text-[0.78rem]',
  lg: 'px-4 py-3 text-[0.875rem]',
  inline: 'p-0 text-[length:inherit]',
};

// variant/size → 클래스 문자열 (다른 컴포넌트에서 a 태그 등에 직접 쓸 때 재사용)
export function buttonClasses(variant: Variant = 'primary', size: Size = 'md', extra = ''): string {
  return `${BASE} ${VARIANT[variant]} ${SIZE[size]} ${extra}`.trim();
}

type CommonProps = { variant?: Variant; size?: Size; className?: string; loading?: boolean; loadingLabel?: string; children: ReactNode };

type ButtonProps = CommonProps & ButtonHTMLAttributes<HTMLButtonElement> & { href?: undefined };
type LinkProps = CommonProps & AnchorHTMLAttributes<HTMLAnchorElement> & { href: string };

export default function Button(props: ButtonProps | LinkProps) {
  const { variant = 'primary', size = 'md', className = '', loading = false, loadingLabel = '처리 중...', children, ...rest } = props;
  const cls = buttonClasses(variant, size, className);

  if ('href' in props && props.href !== undefined) {
    const { href, ...anchorRest } = rest as AnchorHTMLAttributes<HTMLAnchorElement> & { href: string };
    return <a href={href} className={cls} {...anchorRest}>{children}</a>;
  }
  const btnRest = rest as ButtonHTMLAttributes<HTMLButtonElement>;
  return (
    <button className={cls} {...btnRest} disabled={btnRest.disabled || loading}>
      {loading ? loadingLabel : children}
    </button>
  );
}
