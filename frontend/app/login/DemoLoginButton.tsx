'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Button from '@/components/ui/Button';
import ErrorBanner from '@/components/ErrorBanner';
import { IconChevronRight } from '@/components/icons';
import { setAccessToken } from '@/lib/api';

// 데모로 둘러보기 — 데모 사용자 세션을 받아 대시보드로. 데모 빌드(IS_DEMO)의 로그인 화면에서만 쓴다
export default function DemoLoginButton({ apiBase }: { apiBase: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 데모 로그인 요청 → 토큰 저장 후 이동 (이메일 로그인과 같은 흐름)
  async function enter() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${apiBase}/auth/demo`, { method: 'POST', credentials: 'include' });
      const body = (await res.json().catch(() => null)) as { token?: string; message?: string } | null;
      if (!res.ok || !body?.token) throw new Error(body?.message ?? '데모에 들어가지 못했습니다.');
      setAccessToken(body.token);
      router.replace('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : '데모에 들어가지 못했습니다.');
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Button size="lg" className="w-full" onClick={enter} loading={busy} loadingLabel="들어가는 중...">
        데모로 둘러보기<IconChevronRight />
      </Button>
      <ErrorBanner message={error} className="" />
    </div>
  );
}
