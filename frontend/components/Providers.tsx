'use client';

/**
 * 전역 클라이언트 프로바이더 — React Query.
 * 서버 데이터 캐싱/중복제거/자동 갱신을 담당한다. 인증(401)·잠금(423) 응답은 lib/api 가 이미 처리하므로
 * 그 외의 쿼리·뮤테이션 실패를 전역 토스트로 표면화한다.
 */
import { useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider, MutationCache, QueryCache } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { notify } from '@/lib/toast';

// 인증(401)·잠금(423) 은 lib/api 가 리다이렉트/모달로 처리하므로 토스트에서 제외(중복 방지)
function isHandledByApi(err: unknown): boolean {
  return /인증|잠겨|잠금/.test((err as Error)?.message ?? '');
}

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
        // 쿼리(읽기) 에러도 전역으로 표면화 — 각 화면이 누락해도 사용자가 실패를 인지
        queryCache: new QueryCache({
          onError: (err) => {
            if (!isHandledByApi(err)) notify.error((err as Error)?.message ?? '데이터를 불러오지 못했습니다.');
          },
        }),
        mutationCache: new MutationCache({
          onError: (err) => {
            if (!isHandledByApi(err)) notify.error((err as Error)?.message ?? '요청에 실패했습니다.');
          },
        }),
      }),
  );

  return (
    <QueryClientProvider client={client}>
      {children}
      {/* 모바일 하단 내비게이션(BottomNav)과 겹쳐 클릭을 가로채는 것을 방지하기 위해 우상단에 배치 */}
      {process.env.NODE_ENV === 'development' && <ReactQueryDevtools initialIsOpen={false} buttonPosition="top-right" />}
    </QueryClientProvider>
  );
}
