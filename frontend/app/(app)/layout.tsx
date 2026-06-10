'use client';

/**
 * 인증 보호 영역 레이아웃 (route group).
 * (app) 하위 모든 페이지에 공통으로 적용되는 인증 가드.
 * access 토큰은 메모리에만 있어 새로고침 시 사라지므로, httpOnly refresh 쿠키로 세션을 복구한다.
 * 복구 실패 시 로그인 페이지로 리다이렉트하고, 확인 전에는 렌더하지 않는다.
 * URL 에는 (app) 이 포함되지 않으므로 경로는 그대로 유지된다. (예: /dashboard)
 */
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ensureSession } from '@/lib/api';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [authed, setAuthed] = useState(false);

  // 세션 복구 — 메모리에 access 토큰이 있으면 통과, 없으면 refresh 쿠키로 재발급 시도
  useEffect(() => {
    ensureSession().then((ok) => {
      if (ok) {
        setAuthed(true);
      } else {
        router.replace('/login');
      }
    });
  }, [router]);

  // 인증 확인 전에는 빈 화면 (깜빡임/비인가 콘텐츠 노출 방지)
  if (!authed) return null;

  return <>{children}</>;
}
