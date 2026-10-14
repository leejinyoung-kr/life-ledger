// 글자 로고 — "Life" 바로 세운 글자 + "Ledger" 기울인 금빛 글자 (사이드바 · 휴대폰 머리 · 로그인)
export default function Wordmark({ size = 'md' }: { size?: 'md' | 'lg' }) {
  return (
    <span className={`[font-family:var(--font-display)] font-semibold tracking-[-0.01em] text-primary ${size === 'lg' ? 'text-[1.75rem]' : 'text-[1.375rem]'}`}>
      Life<span className="italic font-normal text-accent-dark">Ledger</span>
    </span>
  );
}
