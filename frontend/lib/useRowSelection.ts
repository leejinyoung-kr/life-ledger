'use client';

import { useState } from 'react';

// 행 다중선택 상태 — 체크박스 단건 토글/전체선택/해제 공통 로직.
// ids 는 현재 화면에 보이는 행들의 id 배열 (보통 paged.map((r) => r.id)).
export function useRowSelection(ids: number[]) {
  const [selected, setSelected] = useState<Set<number>>(new Set());

  function toggle(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // 현재 보이는 행이 모두 선택돼 있으면 전체해제, 아니면 전체선택
  function toggleAll() {
    const allSelected = ids.length > 0 && ids.every((id) => selected.has(id));
    setSelected(allSelected ? new Set() : new Set(ids));
  }

  function clear() {
    setSelected(new Set());
  }

  const allChecked = ids.length > 0 && ids.every((id) => selected.has(id));

  return { selected, setSelected, toggle, toggleAll, clear, allChecked };
}
