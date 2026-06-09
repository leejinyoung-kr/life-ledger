/**
 * 공통 토글 스위치 (Tailwind). controlled.
 * 설정/AI리포트 등에서 중복되던 .toggle 을 통합한다.
 */
export default function Toggle({ on, onToggle, label = '토글', disabled = false }: { on: boolean; onToggle: () => void; label?: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={on ? 'true' : 'false'}
      aria-label={label}
      onClick={onToggle}
      disabled={disabled}
      className={`relative w-11 h-6 rounded-full border transition-colors shrink-0 after:content-[''] after:absolute after:top-[3px] after:left-[3px] after:w-4 after:h-4 after:rounded-full after:transition-transform ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'} ${on ? 'bg-accent border-accent after:translate-x-5 after:bg-white' : 'bg-elevated border-border after:bg-muted'}`}
    />
  );
}
