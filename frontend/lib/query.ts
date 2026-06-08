'use client';

/**
 * React Query 얇은 래퍼 — 기존 lib/api 위에 올린다.
 * 페이지는 useState+useEffect+load() 대신 useApiQuery/useApiMutation 으로 전환한다.
 * api.ts 가 401(refresh)·423(잠금해제) 를 이미 처리하므로 여기선 캐싱/무효화만 더한다.
 */
import {
  useQuery,
  useMutation,
  useQueryClient,
  type QueryKey,
  type UseQueryOptions,
  type UseMutationOptions,
} from '@tanstack/react-query';
import { api } from './api';

// GET 쿼리 — 키 + 경로만 주면 캐싱·중복제거·로딩/에러 제공
export function useApiQuery<T>(
  key: QueryKey,
  path: string,
  options?: Omit<UseQueryOptions<T, Error, T, QueryKey>, 'queryKey' | 'queryFn'>,
) {
  return useQuery<T, Error>({
    queryKey: key,
    queryFn: () => api.get<T>(path),
    ...options,
  });
}

// 변이(POST/PUT/PATCH/DELETE/UPLOAD) — 성공 시 invalidate 로 관련 쿼리 자동 갱신
export function useApiMutation<TData, TVars = void>(
  mutationFn: (vars: TVars) => Promise<TData>,
  opts?: { invalidate?: QueryKey[] } & Omit<UseMutationOptions<TData, Error, TVars>, 'mutationFn'>,
) {
  const qc = useQueryClient();
  const { invalidate, onSuccess, ...rest } = opts ?? {};
  return useMutation<TData, Error, TVars>({
    mutationFn,
    // 인자 시그니처는 버전별로 다를 수 있어 그대로 전달
    onSuccess: (...args: Parameters<NonNullable<typeof onSuccess>>) => {
      invalidate?.forEach((k) => qc.invalidateQueries({ queryKey: k }));
      return onSuccess?.(...args);
    },
    ...rest,
  });
}

// 수동 무효화 훅 — 키를 주면 해당 쿼리만, 인자 없이 호출하면 전체 무효화(예: 휴지통 복구 → 여러 도메인)
export function useInvalidate() {
  const qc = useQueryClient();
  return (...keys: QueryKey[]) => {
    if (keys.length === 0) { qc.invalidateQueries(); return; }
    keys.forEach((k) => qc.invalidateQueries({ queryKey: k }));
  };
}
