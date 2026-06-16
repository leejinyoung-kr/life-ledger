'use client';

/**
 * 이메일 코드 로그인 폼 — 구글 로그인 불가 환경용 대체 인증.
 * 1) 이메일 입력 → 코드 발송  2) 메일로 받은 6자리 코드 입력 → 로그인.
 * 코드 검증 성공 시 서버가 refresh 쿠키를 설정하고 access 토큰을 반환한다(credentials: include 필수).
 */
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { setAccessToken } from '@/lib/api';

export default function EmailLoginForm({ apiBase }: { apiBase: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  // 코드 발송 요청 — 이메일 존재/허용 여부와 무관하게 동일 응답(열거 공격 차단)
  async function requestCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${apiBase}/auth/email/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: email.trim() }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.message ?? '요청에 실패했습니다.');
      setStep('code');
      setInfo('등록된 계정이라면 인증코드가 메일로 발송되었습니다. (유효 5분)');
    } catch (err) {
      setError(err instanceof Error ? err.message : '요청에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  }

  // 코드 검증 → 성공 시 토큰 저장 후 대시보드 이동
  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${apiBase}/auth/email/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: email.trim(), code: code.trim() }),
      });
      const body = (await res.json().catch(() => null)) as { token?: string; message?: string } | null;
      if (!res.ok || !body?.token) throw new Error(body?.message ?? '인증에 실패했습니다.');
      setAccessToken(body.token);
      router.replace('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : '인증에 실패했습니다.');
      setBusy(false);
    }
  }

  // 접힌 상태 — 진입 링크
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full text-center text-[0.8rem] text-secondary hover:text-primary transition-colors py-1"
      >
        구글 로그인이 어렵나요? <span className="text-accent font-medium">이메일로 로그인</span>
      </button>
    );
  }

  return (
    <div className="mt-1">
      {error && (
        <p className="text-[0.76rem] text-[#dc2626] mb-2 break-keep" role="alert">{error}</p>
      )}
      {info && step === 'code' && (
        <p className="text-[0.76rem] text-secondary mb-2 break-keep">{info}</p>
      )}

      {step === 'email' ? (
        <form onSubmit={requestCode} className="flex flex-col gap-2.5">
          <input
            type="email"
            required
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="이메일 주소"
            className="w-full p-3 bg-background border border-border rounded-[var(--radius)] text-primary text-[0.875rem] outline-none transition-all focus:border-accent focus:shadow-[0_0_0_3px_var(--accent-dim)]"
          />
          <button
            type="submit"
            disabled={busy || !email.trim()}
            className="w-full p-3 bg-accent text-white rounded-[var(--radius)] text-[0.875rem] font-medium cursor-pointer transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {busy ? '발송 중...' : '인증코드 받기'}
          </button>
        </form>
      ) : (
        <form onSubmit={verifyCode} className="flex flex-col gap-2.5">
          <input
            type="text"
            inputMode="numeric"
            required
            autoFocus
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            placeholder="6자리 인증코드"
            className="w-full p-3 bg-background border border-border rounded-[var(--radius)] text-primary text-[1rem] tracking-[0.3em] text-center font-mono outline-none transition-all focus:border-accent focus:shadow-[0_0_0_3px_var(--accent-dim)]"
          />
          <button
            type="submit"
            disabled={busy || code.length !== 6}
            className="w-full p-3 bg-accent text-white rounded-[var(--radius)] text-[0.875rem] font-medium cursor-pointer transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {busy ? '확인 중...' : '로그인'}
          </button>
          <button
            type="button"
            onClick={() => { setStep('email'); setCode(''); setError(null); setInfo(null); }}
            className="text-[0.76rem] text-muted hover:text-secondary transition-colors"
          >
            이메일 다시 입력
          </button>
        </form>
      )}
    </div>
  );
}
