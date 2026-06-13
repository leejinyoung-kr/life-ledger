'use client';

import { useState } from 'react';

// 폼 필드별 에러 메시지 상태 + 클리어 헬퍼 — 페이지마다 복붙되던 clearErr()를 대체.
export function useFormErrors(initial: Record<string, string> = {}) {
  const [errors, setErrors] = useState<Record<string, string>>(initial);

  function setError(field: string, message: string) {
    setErrors((p) => ({ ...p, [field]: message }));
  }

  function clearError(field: string) {
    setErrors((p) => {
      if (!(field in p)) return p;
      const n = { ...p };
      delete n[field];
      return n;
    });
  }

  function reset(next: Record<string, string> = {}) {
    setErrors(next);
  }

  return { errors, setErrors, setError, clearError, reset };
}
