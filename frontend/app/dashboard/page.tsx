'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function DashboardPage() {
  const router = useRouter();

  useEffect(() => {
    if (!localStorage.getItem('auth_token')) {
      router.replace('/login');
    }
  }, [router]);

  function logout() {
    localStorage.removeItem('auth_token');
    router.push('/login');
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: '#ffffff',
      }}
    >
      <button
        onClick={logout}
        style={{
          padding: '10px 24px',
          background: '#111418',
          color: '#eef0f3',
          border: 'none',
          borderRadius: '8px',
          fontSize: '0.875rem',
          fontWeight: 500,
          cursor: 'pointer',
        }}
      >
        로그아웃
      </button>
    </div>
  );
}
