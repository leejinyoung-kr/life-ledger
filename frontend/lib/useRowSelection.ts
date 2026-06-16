'use client';

import { useState } from 'react';

// 행 다중선택 상태 — 체크박스 단건 토글/전체선택/해제 공통 로직.
// id 타입은 number(보통) 또는 string(예: 휴지통의 합성 key) 모두 지원.
// ids 는 현재 화면에 보이는 행들의 id 배열 (보통 paged.map((r) => r.id)).
export function useRowSelection<T = number>(ids: T[]) {
  const [selected, setSelected] = useState<Set<T>>(new Set());

  function toggle(id: T) {
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
    setSelected(new Set<T>());
  }

  const allChecked = ids.length > 0 && ids.every((id) => selected.has(id));

  return { selected, setSelected, toggle, toggleAll, clear, allChecked };
}
