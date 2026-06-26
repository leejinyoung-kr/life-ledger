'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { setAccessToken } from '@/lib/api';

export default function CallbackHandler() {
  const router = useRouter();

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get('token');
    if (token) {
      setAccessToken(token);
      router.replace('/dashboard');
    } else {
      router.replace('/login');
    }
  }, [router]);

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
