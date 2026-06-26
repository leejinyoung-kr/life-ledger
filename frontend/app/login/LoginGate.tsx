'use client';

/**
 * 로그인 페이지 진입 가드.
 * 유효한 refresh 쿠키가 있으면 로그인 폼을 보여주지 않고 곧장 대시보드로 보낸다.
 * 확인 끝나기 전까지는 children(로그인 폼)을 렌더하지 않아 깜빡임을 없앤다.
 */
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ensureSession } from '@/lib/api';

export default function LoginGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    ensureSession().then((ok) => {
      if (ok) {
        router.replace('/dashboard');
      } else {
        setChecking(false);
      }
    });
  }, [router]);

  if (checking) return null;
  return <>{children}</>;
}
