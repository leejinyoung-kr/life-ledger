'use client';

import { AlertCircle } from 'lucide-react';
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
    <div role="alert" className={`flex gap-2.5 items-start px-4 py-3 rounded-ui border border-danger/25 bg-danger-dim text-[0.8125rem] text-primary ${className}`}>
      <AlertCircle size={16} className="text-danger shrink-0 mt-0.5" aria-hidden />
      <span className="flex-1">{message ?? '불러오지 못했습니다. 연결을 확인하세요.'}</span>
      {onRetry && <Button variant="ghost" size="sm" onClick={onRetry}>다시 시도</Button>}
    </div>
  );
}
