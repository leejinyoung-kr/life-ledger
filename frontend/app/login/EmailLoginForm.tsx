'use client';

/**
 * 이메일 코드 로그인 폼 — 구글 로그인 불가 환경용 대체 인증.
 * 1) 이메일 입력 → 코드 발송  2) 메일로 받은 6자리 코드 입력 → 로그인.
 * 코드 검증 성공 시 서버가 refresh 쿠키를 설정하고 access 토큰을 반환한다(credentials: include 필수).
 */
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { setAccessToken } from '@/lib/api';
import Button from '@/components/ui/Button';
import ErrorBanner from '@/components/ErrorBanner';

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
      <Button type="button" variant="link" size="inline" onClick={() => setOpen(true)} className="self-center text-[0.84rem]">
        구글 로그인이 어렵나요? 이메일로 로그인
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-2.5 pt-3.5 border-t border-border-subtle">
      <ErrorBanner message={error} className="" />
      {info && step === 'code' && (
        <p className="text-[0.78rem] text-muted break-keep">{info}</p>
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
            className="input input-lg"
          />
          <Button type="submit" size="lg" className="w-full" disabled={!email.trim()} loading={busy} loadingLabel="발송 중...">
            인증코드 받기
          </Button>
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
            className="input input-lg text-[1rem] tracking-[0.3em] text-center font-mono"
          />
          <Button type="submit" size="lg" className="w-full" disabled={code.length !== 6} loading={busy} loadingLabel="확인 중...">
            로그인
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => { setStep('email'); setCode(''); setError(null); setInfo(null); }}
          >
            이메일 다시 입력
          </Button>
        </form>
      )}
    </div>
  );
}
