import type { InputHTMLAttributes } from 'react';

// 단위(₩ · $ · % · 주)가 안쪽에 붙는 숫자 입력칸 — 값은 오른쪽 정렬, 단위는 left 면 앞 · right 면 뒤
export function UnitInput({ unit, side = 'left', ...rest }: { unit: string; side?: 'left' | 'right' } & Omit<InputHTMLAttributes<HTMLInputElement>, 'className'>) {
  return (
    <div className="relative">
      <span className={`absolute top-1/2 -translate-y-1/2 text-muted pointer-events-none ${side === 'left' ? 'left-3' : 'right-3'}`}>{unit}</span>
      <input type="number" className={`input text-right ${side === 'left' ? 'pl-8' : 'pr-9'}`} {...rest} />
    </div>
  );
}
