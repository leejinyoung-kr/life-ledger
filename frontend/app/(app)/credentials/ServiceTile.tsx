// 서비스 이름 첫 글자를 담은 테두리 칸 — 목록 행과 상세 창 머리에 쓴다
export default function ServiceTile({ name, size = 'md' }: { name: string; size?: 'md' | 'lg' }) {
  const box = size === 'lg' ? 'w-9 h-9 text-[1.125rem]' : 'w-7 h-7 text-[0.875rem]';
  return (
    <span aria-hidden className={`${box} shrink-0 border border-border rounded-ui grid place-items-center [font-family:var(--font-display)] text-muted`}>
      {name.trim().charAt(0).toUpperCase()}
    </span>
  );
}

// 2FA 설정 여부 표시 — 미설정은 경고색
export function TwoFaMark({ on }: { on: boolean }) {
  return on
    ? <span className="inline-flex items-center gap-1 text-[0.78rem] text-success">설정</span>
    : <span className="inline-flex items-center gap-1 text-[0.78rem] text-warning">미설정</span>;
}
