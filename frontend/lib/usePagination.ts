'use client';

import { useState } from 'react';

// 목록 페이징 상태 — page/limit 관리 + limit 변경 시 1페이지로 되돌리는 공통 헬퍼.
// totalPages 는 total 이 쿼리 응답에 따라 정해지므로 호출부에서 Math.ceil(total / limit) 로 계산한다.
export function usePagination(initialLimit = 10) {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(initialLimit);

  // limit 변경 시 항상 첫 페이지로 이동 (LimitSelect onLimitChange 용)
  function changeLimit(n: number) {
    setLimit(n);
    setPage(1);
  }

  return { page, setPage, limit, setLimit, changeLimit };
}
