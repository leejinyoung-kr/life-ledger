'use client';

/**
 * [발표용 임시] 아이디/비밀번호 아무 값이나 입력해도 로그인되는 폼.
 * 발표 끝나면 이 파일 삭제하고 login/page.tsx의 주석 처리를 원복할 것.
 */
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { setAccessToken } from '@/lib/api';

export default function DemoLoginForm({ apiBase }: { apiBase: string }) {
  const router = useRouter();
  const [id, setId] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!id.trim() || !password.trim()) {
      setError('아이디와 비밀번호를 모두 입력하세요.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${apiBase}/auth/demo-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ id: id.trim(), password: password.trim() }),
      });
      const body = (await res.json().catch(() => null)) as { token?: string; message?: string } | null;
      if (!res.ok || !body?.token) throw new Error(body?.message ?? '로그인에 실패했습니다.');
      setAccessToken(body.token);
      router.replace('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : '로그인에 실패했습니다.');
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2.5">
      {error && (
        <p className="text-[0.76rem] text-[#dc2626] break-keep" role="alert">{error}</p>
      )}
      <input
        type="text"
        autoFocus
        value={id}
        onChange={(e) => setId(e.target.value)}
        placeholder="아이디"
        className="w-full p-3 bg-background border border-border rounded-[var(--radius)] text-primary text-[0.875rem] outline-none transition-all focus:border-accent focus:shadow-[0_0_0_3px_var(--accent-dim)]"
      />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="비밀번호"
        className="w-full p-3 bg-background border border-border rounded-[var(--radius)] text-primary text-[0.875rem] outline-none transition-all focus:border-accent focus:shadow-[0_0_0_3px_var(--accent-dim)]"
      />
      <button
        type="submit"
        disabled={busy || !id.trim() || !password.trim()}
        className="w-full p-3 bg-accent text-white rounded-[var(--radius)] text-[0.875rem] font-medium cursor-pointer transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {busy ? '로그인 중...' : '로그인'}
      </button>
    </form>
  );
}
