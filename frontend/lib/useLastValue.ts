'use client';

import { useState } from 'react';

// 값이 null 이 돼도 마지막 값을 돌려준다 — 상세 창을 닫을 때(값 → null) 흐려지는 동안 내용이 그대로 보이게.
// 창은 open={!!value} 로 여닫고, 내용은 이 훅이 돌려준 값으로 그린다
export function useLastValue<T>(value: T | null): T | null {
  const [last, setLast] = useState(value);
  // 렌더 중 이전 값 기억 (React 문서의 "이전 렌더의 정보 저장" 방식)
  if (value !== null && value !== last) setLast(value);
  return value ?? last;
}
