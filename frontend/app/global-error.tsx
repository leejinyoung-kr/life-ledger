'use client';

import { useEffect } from 'react';

// 루트 레이아웃까지 무너진 치명적 에러용 바운더리 — 자체 html/body 를 렌더해야 한다.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="ko">
      <body style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', gap: 16, fontFamily: 'sans-serif', background: '#0a0a0a', color: '#fff' }}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 600 }}>문제가 발생했습니다</h2>
        <p style={{ fontSize: '0.875rem', opacity: 0.7 }}>앱을 불러오는 중 오류가 발생했습니다.</p>
        <button onClick={reset} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #333', background: '#1a1a1a', color: '#fff', cursor: 'pointer' }}>
          다시 시도
        </button>
      </body>
    </html>
  );
}
