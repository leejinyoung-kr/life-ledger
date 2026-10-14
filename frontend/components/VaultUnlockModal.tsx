'use client';

/**
 * 마스터 잠금 해제 모달.
 * AppShell 에 1회 마운트되어 lib/vault 의 잠금해제 핸들러로 등록된다.
 * reveal 류 요청이 423(VAULT_LOCKED)을 받으면 api 래퍼가 이 모달을 띄우고,
 * 마스터 비번 검증(/security/vault/unlock) 성공 시 토큰을 저장한 뒤 원요청을 재시도한다.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import ConfirmModal from './ConfirmModal';
import ErrorBanner from './ErrorBanner';
import { IconLock } from './icons';
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

  return (
    <ConfirmModal
      open
      layer="top"
      variant="primary"
      icon={<IconLock />}
      title="보관함이 잠겨 있습니다"
      message="마스터 비밀번호를 입력하면 하던 열람을 이어서 합니다."
      confirmLabel="잠금 풀기"
      loading={busy}
      loadingLabel="확인 중..."
      confirmDisabled={!password}
      onConfirm={submit}
      onCancel={() => finish(false)}
    >
      <input
        className="input"
        type="password"
        autoFocus
        value={password}
        placeholder="마스터 비밀번호"
        onChange={(e) => setPassword(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
      />
      <ErrorBanner message={error} className="mt-0" />
    </ConfirmModal>
  );
}
