'use client';

import QueryError from './QueryError';

// 페이지 한가운데에 표시하는 공통 "불러오는 중..." 텍스트.
export function PageLoading({
  message = '불러오는 중...',
  className = '',
}: {
  message?: string;
  className?: string;
}) {
  return <div className={`text-center py-16 text-muted text-sm ${className}`}>{message}</div>;
}

interface QueryLike {
  isLoading: boolean;
  isError: boolean;
  refetch?: () => void;
}

// 단일 쿼리의 로딩/에러/완료 상태를 한 번에 처리.
// dataQuery.isError ? <QueryError .../> : loading ? <PageLoading/> : (...) 패턴을 대체한다.
export default function QueryState({
  query,
  errorMessage,
  loadingMessage,
  children,
}: {
  query: QueryLike;
  errorMessage?: string;
  loadingMessage?: string;
  children: React.ReactNode;
}) {
  if (query.isError) {
    return <QueryError message={errorMessage} onRetry={query.refetch} />;
  }
  if (query.isLoading) {
    return <PageLoading message={loadingMessage} />;
  }
  return <>{children}</>;
}
