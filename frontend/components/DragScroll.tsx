'use client';

/**
 * 가로로 넘치는 줄 — 얇은 스크롤 막대를 보이고, 마우스로 끌어서도 옆으로 넘긴다 (터치는 브라우저 기본 스크롤).
 * 끌다 놓았을 때는 안쪽 버튼이 눌리지 않게 그 클릭을 막는다.
 */
import { useRef, type PointerEvent, type MouseEvent, type ReactNode } from 'react';

// 끌어서 넘기는 가로 스크롤 상자
export default function DragScroll({ className = '', children }: { className?: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; left: number; moved: boolean; id: number } | null>(null);
  // 끌기를 막 끝낸 직후의 클릭 한 번은 버튼에 넘기지 않는다
  const suppressClick = useRef(false);

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    suppressClick.current = false;
    if (e.pointerType !== 'mouse' || e.button !== 0 || !ref.current) return;
    drag.current = { x: e.clientX, left: ref.current.scrollLeft, moved: false, id: e.pointerId };
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    const d = drag.current;
    const el = ref.current;
    if (!d || !el) return;
    const dx = e.clientX - d.x;
    // 몇 px 넘게 움직여야 끌기로 본다 — 그냥 누르면 버튼 클릭 그대로
    if (!d.moved && Math.abs(dx) > 4) {
      d.moved = true;
      el.setPointerCapture(d.id);
    }
    if (d.moved) el.scrollLeft = d.left - dx;
  }

  function onPointerUp() {
    if (drag.current?.moved) suppressClick.current = true;
    drag.current = null;
  }

  function onClickCapture(e: MouseEvent<HTMLDivElement>) {
    if (!suppressClick.current) return;
    suppressClick.current = false;
    e.preventDefault();
    e.stopPropagation();
  }

  return (
    <div
      ref={ref}
      className={`overflow-x-auto scrollbar-thin select-none ${className}`.trim()}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onClickCapture={onClickCapture}
    >
      {children}
    </div>
  );
}
