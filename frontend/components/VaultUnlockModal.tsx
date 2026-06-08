'use client';

/**
 * 마스터 잠금 해제 모달.
 * AppShell 에 1회 마운트되어 lib/vault 의 잠금해제 핸들러로 등록된다.
 * reveal 류 요청이 423(VAULT_LOCKED)을 받으면 api 래퍼가 이 모달을 띄우고,
 * 마스터 비번 검증(/security/vault/unlock) 성공 시 토큰을 저장한 뒤 원요청을 재시도한다.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Button from './ui/Button';
import { api } from '@/lib/api';
import { registerVaultUnlock, setVaultToken } from '@/lib/vault';

export default function VaultUnlockModal() {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // 대기 중인 잠금해제 요청의 resolve (성공/취소 결과를 api 래퍼로 돌려줌)
  const resolveRef = useRef<((ok: boolean) => void) | null>(null);

  // 잠금해제 핸들러 등록 — 모달을 열고 사용자 입력 결과를 Promise 로 반환
  useEffect(() => {
    registerVaultUnlock(
      () =>
        new Promise<boolean>((resolve) => {
          resolveRef.current = resolve;
          setPassword('');
          setError(null);
          setOpen(true);
        }),
    );
    return () => registerVaultUnlock(null);
  }, []);

  // 결과 확정 후 모달 닫기
  const finish = useCallback((ok: boolean) => {
    resolveRef.current?.(ok);
    resolveRef.current = null;
    setOpen(false);
    setBusy(false);
  }, []);

  // 마스터 비번 검증 → vault 토큰 저장
  const submit = useCallback(async () => {
    if (!password || busy) return;
    setBusy(true);
    setError(null);
    try {
      const r = await api.post<{ token: string; expiresIn: number }>('/security/vault/unlock', { password });
      setVaultToken(r.token, r.expiresIn);
      finish(true);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }, [password, busy, finish]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 bg-[rgba(0,0,0,0.52)] backdrop-blur-[3px] z-[400] flex items-center justify-center p-6 [animation:fadeIn_0.2s_ease]" role="presentation">
      <div className="bg-background border border-border rounded-2xl shadow-[var(--shadow-lg)] w-full max-w-[360px] px-6 pt-8 pb-6 flex flex-col items-center gap-[18px] text-center [animation:slideUp_0.25s_ease]" role="dialog" aria-modal="true">
        <div className="w-[60px] h-[60px] rounded-full flex items-center justify-center shrink-0 bg-accent-dim text-accent text-[28px]">🔒</div>
        <div>
          <p className="text-[1rem] font-bold text-primary mb-1">보관함 잠금</p>
          <p className="text-[0.85rem] text-secondary leading-[1.6] [word-break:keep-all]">민감 정보를 보려면 마스터 비밀번호를 입력하세요.</p>
        </div>
        <input
          className="input w-full text-center"
          type="password"
          autoFocus
          value={password}
          placeholder="마스터 비밀번호"
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
        />
        {error && <p className="text-[0.78rem] text-danger -mt-2">⚠️ {error}</p>}
        <div className="flex gap-2 w-full">
          <Button variant="ghost" className="flex-1" onClick={() => finish(false)} disabled={busy}>취소</Button>
          <Button className="flex-1" onClick={submit} disabled={busy || !password}>{busy ? '확인 중...' : '잠금 해제'}</Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
