'use client';

import { useCallback, useState } from 'react';

// 폼 필드별 에러 메시지 상태 + 클리어 헬퍼 — 페이지마다 복붙되던 clearErr()를 대체.
export function useFormErrors(initial: Record<string, string> = {}) {
  const [errors, setErrors] = useState<Record<string, string>>(initial);

  // useEffect deps에 안전하게 넣을 수 있도록 참조를 고정한다 (매 렌더 재생성 방지)
  const setError = useCallback((field: string, message: string) => {
    setErrors((p) => ({ ...p, [field]: message }));
  }, []);

  const clearError = useCallback((field: string) => {
    setErrors((p) => {
      if (!(field in p)) return p;
      const n = { ...p };
      delete n[field];
      return n;
    });
  }, []);

  const reset = useCallback((next: Record<string, string> = {}) => {
    setErrors(next);
  }, []);

  return { errors, setErrors, setError, clearError, reset };
}
