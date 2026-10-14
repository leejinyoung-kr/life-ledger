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
  'inline-flex items-center justify-center gap-1.5 rounded-ui font-medium whitespace-nowrap transition-all cursor-pointer [&_svg]:w-[15px] [&_svg]:h-[15px] disabled:opacity-45 disabled:cursor-not-allowed disabled:pointer-events-none';

const VARIANT: Record<Variant, string> = {
  // 주 버튼은 진한 초록으로 채우고 흰 글자 (밝은 초록 바탕은 흰 글자 대비가 모자라 accent-dark 를 쓴다)
  primary: 'bg-accent-dark text-on-solid border border-accent-dark font-semibold hover:bg-accent-press hover:border-accent-press',
  ghost: 'bg-background text-primary border border-border hover:bg-surface',
  // 삭제로 가는 첫 단계 — 지출 색 테두리. 채운 버튼(solid-danger)은 확인 창 안에서만
  danger: 'bg-transparent text-danger border border-danger hover:bg-danger-dim',
  'solid-danger': 'bg-danger text-on-solid border border-danger font-semibold hover:bg-danger-dark hover:border-danger-dark',
  link: 'bg-transparent text-accent-dark underline underline-offset-[3px] hover:text-accent',
};

const SIZE: Record<Size, string> = {
  md: 'min-h-9 px-3.5 py-1.5 text-[0.875rem]',
  sm: 'min-h-[30px] px-2.5 py-1 text-[0.8125rem]',
  lg: 'min-h-11 px-5 py-2.5 text-[0.9375rem]',
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
