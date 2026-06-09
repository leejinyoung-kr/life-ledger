'use client';

import { useEffect } from 'react';
import Button from '@/components/ui/Button';

// (app) 하위 전 페이지 공통 에러 바운더리 — 렌더 중 던져진 예외를 잡아 복구 UI 표시.
// 페이지 컴포넌트 크래시 시 빈 화면 대신 재시도 경로를 제공한다.
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // 운영 환경에선 에러 트래킹(Sentry 등)으로 보낼 자리
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
      <div className="text-lg font-semibold text-primary">문제가 발생했습니다</div>
      <div className="text-sm text-muted max-w-md">
        페이지를 표시하는 중 오류가 발생했습니다. 다시 시도해 주세요.
      </div>
      <Button onClick={reset}>다시 시도</Button>
    </div>
  );
}
