'use client';

import Button from './ui/Button';

// React Query 조회 실패 시 공통 표시 — 메시지 + 재시도 버튼.
export default function QueryError({
  message,
  onRetry,
  className = '',
}: {
  message?: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div className={`text-center py-16 flex flex-col items-center gap-3 ${className}`}>
      <div className="text-sm text-danger">⚠️ {message ?? '데이터를 불러오지 못했습니다.'}</div>
      {onRetry && (
        <Button variant="ghost" size="sm" onClick={onRetry}>다시 시도</Button>
      )}
    </div>
  );
}
