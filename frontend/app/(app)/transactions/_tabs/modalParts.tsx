import type { InputHTMLAttributes, ReactNode } from 'react';

// 짧은 선택지 묶음(Segmented joined)을 칸 너비에 꽉 채우는 배치용 클래스

// 단위(₩ · $ · % · 주)가 안쪽에 붙는 숫자 입력칸 — 값은 오른쪽 정렬, 단위는 left 면 앞 · right 면 뒤
export function UnitInput({ unit, side = 'left', ...rest }: { unit: string; side?: 'left' | 'right' } & Omit<InputHTMLAttributes<HTMLInputElement>, 'className'>) {
  return (
    <div className="relative">
      <span className={`absolute top-1/2 -translate-y-1/2 text-muted pointer-events-none ${side === 'left' ? 'left-3' : 'right-3'}`}>{unit}</span>
      <input type="number" className={`input text-right ${side === 'left' ? 'pl-8' : 'pr-9'}`} {...rest} />
    </div>
  );
}

// 긴 창의 번호 붙은 묶음 — 한 묶음 = 한 질문. 첫 묶음이 아니면 위에 선을 긋는다
export function FormGroup({ no, title, first, children }: { no: number; title: string; first?: boolean; children: ReactNode }) {
  return (
    <section className={`flex flex-col gap-3 ${first ? '' : 'pt-4 border-t border-border-subtle'}`}>
      <div className="flex items-baseline gap-2 text-[0.78rem] text-accent-dark">
        <span className="font-bold text-[1.0625rem]">{no}</span>
        {title}
      </div>
      {children}
    </section>
  );
}
