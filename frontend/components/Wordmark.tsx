// 글자 로고 — 굵은 "생활" + 초록 "모아" (사이드바 · 휴대폰 머리 · 로그인)
export default function Wordmark({ size = 'md' }: { size?: 'md' | 'lg' }) {
  return (
    <span className={`font-extrabold tracking-[-0.02em] text-primary ${size === 'lg' ? 'text-[1.75rem]' : 'text-[1.375rem]'}`}>
      생활<span className="text-accent-dark">모아</span>
    </span>
  );
}
