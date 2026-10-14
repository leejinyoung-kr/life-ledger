'use client';

import { AlertCircle } from 'lucide-react';

// 조회 실패 시 표시하는 인라인 배너 — 위쪽 2px 선 + 옅은 지출 색 바탕.
// 재시도 버튼이 달린 큰 블록이 필요하면 QueryError 를 쓴다.
// message 가 비면 아무것도 렌더하지 않으므로 호출부에서 조건 분기 없이 그냥 둘 수 있다.
// 간격은 페이지마다 달라 className 으로 덮어쓴다 (기본 mt-3 mb-3).
export default function ErrorBanner({
  message,
  className = 'mt-3 mb-3',
}: {
  message?: string | null;
  className?: string;
}) {
  if (!message) return null;
  return (
    <div role="alert" className={`flex gap-2.5 items-start px-3.5 py-3 border-t-2 border-danger bg-danger-dim text-[0.8125rem] text-primary ${className}`}>
      <AlertCircle size={16} className="text-danger shrink-0 mt-0.5" aria-hidden />
      <span className="flex-1">{message}</span>
    </div>
  );
}
