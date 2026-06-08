'use client';

/**
 * 전역 클라이언트 프로바이더 — React Query.
 * 서버 데이터 캐싱/중복제거/자동 갱신을 담당한다. 인증(401)·잠금(423) 응답은 lib/api 가 이미 처리하므로
 * 여기서는 mutation 실패만 토스트로 표면화한다(쿼리 에러는 각 화면이 처리).
 */
import { useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider, MutationCache } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { notify } from '@/lib/toast';

export default function Providers({ children }: { children: ReactNode }) {
  // 요청당 한 번만 생성 (리렌더 시 캐시 유지)
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000, // 30초 내 재진입은 캐시 사용(중복호출 방지)
            refetchOnWindowFocus: false,
            // 인증/잠금 에러는 재시도 무의미 — 그 외 1회만 재시도
            retry: (count, err) =>
              count < 1 && !/인증|잠겨|잠금/.test((err as Error)?.message ?? ''),
          },
        },
        mutationCache: new MutationCache({
          onError: (err) => notify.error((err as Error)?.message ?? '요청에 실패했습니다.'),
        }),
      }),
  );

  return (
    <QueryClientProvider client={client}>
      {children}
      {process.env.NODE_ENV === 'development' && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  );
}
