/**
 * 공통 토글 스위치 (Tailwind). controlled.
 * 켜짐은 초록 테두리 + 옅은 초록 바탕 + 초록 손잡이, 꺼짐은 선만. 올리면 테두리 · 바탕이 조금 진해진다.
 */
export default function Toggle({ on, onToggle, label = '토글', disabled = false }: { on: boolean; onToggle: () => void; label?: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={on ? 'true' : 'false'}
      aria-label={label}
      onClick={onToggle}
      disabled={disabled}
      className={`relative w-9 h-5 rounded-full border transition-colors shrink-0 after:content-[''] after:absolute after:top-[3px] after:left-[3px] after:w-3 after:h-3 after:rounded-full after:transition-transform ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'} ${on ? 'bg-accent-dim border-accent after:translate-x-4 after:bg-accent enabled:hover:bg-accent-hover' : 'bg-transparent border-border after:bg-muted enabled:hover:border-border-hover enabled:hover:bg-hover'}`}
    />
  );
}
