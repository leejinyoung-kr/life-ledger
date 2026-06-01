import { Suspense } from 'react';
import CallbackHandler from './CallbackHandler';

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            background: 'var(--bg-surface)',
            color: 'var(--text-secondary)',
            fontSize: '0.875rem',
          }}
        >
          로그인 중...
        </div>
      }
    >
      <CallbackHandler />
    </Suspense>
  );
}
