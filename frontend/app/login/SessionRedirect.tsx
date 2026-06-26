'use client';

/**
 * 로그인 페이지 진입 시 이미 유효한 refresh 쿠키가 있으면 대시보드로 바로 보낸다.
 * 사용자가 "/" 가 아니라 "/login" 으로 직접 들어온 경우(북마크·히스토리 등)에도
 * 세션 복구가 동작하도록 보강.
 */
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ensureSession } from '@/lib/api';

export default function SessionRedirect() {
  const router = useRouter();

  useEffect(() => {
    ensureSession().then((ok) => {
      if (ok) router.replace('/dashboard');
    });
  }, [router]);

  return null;
}
