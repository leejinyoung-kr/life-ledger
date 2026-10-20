import { useMemo } from 'react';
import { useApiQuery } from '@/lib/query';
import type { Category } from '@/lib/finance';

// 계정 카테고리 목록 — 코드 관리(credential_cat)에서 사용 중인 라벨을 코드 관리 순서대로. 계정에는 라벨이 저장된다
export function useCredentialCategories(): string[] {
  const query = useApiQuery<Category[]>(['categories', 'credential_cat'], '/categories?domain=credential_cat');
  return useMemo(() => (query.data ?? []).filter((c) => c.isActive).map((c) => c.label), [query.data]);
}
