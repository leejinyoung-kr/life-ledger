'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function CallbackHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const token = searchParams.get('token');
    if (token) {
      localStorage.setItem('auth_token', token);
      router.replace('/dashboard');
    } else {
      router.replace('/login');
    }
  }, [router, searchParams]);

  return (
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
  );
}
