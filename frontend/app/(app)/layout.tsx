'use client';

/**
 * 인증 보호 영역 레이아웃 (route group).
 * (app) 하위 모든 페이지에 공통으로 적용되는 인증 가드.
 * 토큰이 없으면 로그인 페이지로 리다이렉트하고, 확인 전에는 렌더하지 않는다.
 * URL 에는 (app) 이 포함되지 않으므로 경로는 그대로 유지된다. (예: /dashboard)
 */
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [authed, setAuthed] = useState(false);

  // 토큰 확인 — 없으면 /login 으로. localStorage 는 클라이언트에서만 접근 가능
  useEffect(() => {
    if (localStorage.getItem('auth_token')) {
      setAuthed(true);
    } else {
      router.replace('/login');
    }
  }, [router]);

  // 인증 확인 전에는 빈 화면 (깜빡임/비인가 콘텐츠 노출 방지)
  if (!authed) return null;

  return <>{children}</>;
}
