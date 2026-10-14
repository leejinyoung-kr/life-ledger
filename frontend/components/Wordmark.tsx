// 글자 로고 — 굵은 "Life" + 초록 "Ledger" (사이드바 · 휴대폰 머리 · 로그인)
export default function Wordmark({ size = 'md' }: { size?: 'md' | 'lg' }) {
  return (
    <span className={`font-extrabold tracking-[-0.02em] text-primary ${size === 'lg' ? 'text-[1.75rem]' : 'text-[1.375rem]'}`}>
      Life<span className="text-accent-dark">Ledger</span>
    </span>
  );
}
