'use client';

import { useEffect, useRef, useState } from 'react';
import { notify, copyToClipboard } from '@/lib/toast';
import { api } from '@/lib/api';
import { fmtCredDate, type Credential, type CredentialSecret, type TotpCode, type BackupCodes } from '@/lib/credential';
import Modal from '@/components/Modal';
import Button from '@/components/ui/Button';
import IconButton from '@/components/ui/IconButton';
import { IconCopy, IconEye, IconClock, IconClose } from '@/components/icons';
import ServiceTile from './ServiceTile';

// 설정의 pwAutoHide(10s|30s|1m|none) → ms. none/누락 시 null(자동 숨김 안 함)
function pwAutoHideMs(v: string | undefined): number | null {
  if (v === '10s') return 10000;
  if (v === '30s') return 30000;
  if (v === '1m') return 60000;
  return null;
}

// 계정 상세 모달 — 열릴 때 reveal 로 원문을 받아 비밀번호 마스킹/표시/복사 (표시 시 설정한 시간 후 자동 숨김)
export default function DetailModal({ cred, pwAutoHide, onClose, onEdit, onDelete }: { cred: Credential | null; pwAutoHide?: string; onClose: () => void; onEdit: () => void; onDelete: () => void }) {
  const [secret, setSecret] = useState<CredentialSecret | null>(null);
  const [totp, setTotp] = useState<TotpCode | null>(null);
  const [pwVisible, setPwVisible] = useState(false);
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [backupBusy, setBackupBusy] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 모달이 바뀌면 원문을 새로 받아오고 비밀번호는 다시 가린다
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 선택된 자격증명 변경 시 표시 상태 초기화
    setPwVisible(false);
    setSecret(null);
    setBackupCodes(null);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    if (!cred) return;
    api.get<CredentialSecret>(`/credentials/${cred.id}/reveal`).then(setSecret).catch(() => {});
    return () => { if (hideTimer.current) clearTimeout(hideTimer.current); };
  }, [cred]);

  // 2FA 계정이면 현재 TOTP 코드를 받아 1초마다 카운트다운, 만료 시 재요청
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 선택된 자격증명 변경 시 TOTP 코드 초기화
    setTotp(null);
    if (!cred?.has2fa) return;
    let active = true;
    const fetchCode = () => api.get<TotpCode>(`/credentials/${cred.id}/totp`).then((t) => { if (active) setTotp(t); }).catch(() => {});
    fetchCode();
    const iv = setInterval(() => {
      setTotp((prev) => {
        if (!prev) return prev;
        if (prev.remaining <= 1) { fetchCode(); return { ...prev, remaining: 0 }; }
        return { ...prev, remaining: prev.remaining - 1 };
      });
    }, 1000);
    return () => { active = false; clearInterval(iv); };
  }, [cred]);

  if (!cred) return null;

  // 비밀번호 표시/숨김 토글 — 표시 시 설정한 시간 뒤 자동 숨김 예약(설정이 '없음'이면 예약 안 함)
  function handleTogglePw() {
    setPwVisible((v) => {
      const next = !v;
      if (hideTimer.current) clearTimeout(hideTimer.current);
      const ms = pwAutoHideMs(pwAutoHide);
      if (next && ms) hideTimer.current = setTimeout(() => setPwVisible(false), ms);
      return next;
    });
  }

  // 백업코드 생성(기존 덮어씀) — 평문은 이 응답에서만 노출
  async function handleGenBackup() {
    if (!cred || backupBusy) return;
    setBackupBusy(true);
    try {
      const r = await api.post<{ codes: string[] }>(`/credentials/${cred.id}/backup-codes`, {});
      setBackupCodes(r.codes);
      notify.success('백업코드를 생성했습니다. 안전한 곳에 보관하세요.');
    } catch (e) { notify.error((e as Error).message); }
    finally { setBackupBusy(false); }
  }

  // 저장된 백업코드 조회
  async function handleViewBackup() {
    if (!cred || backupBusy) return;
    setBackupBusy(true);
    try {
      const r = await api.get<BackupCodes>(`/credentials/${cred.id}/backup-codes`);
      setBackupCodes(r.codes);
    } catch (e) { notify.error((e as Error).message); }
    finally { setBackupBusy(false); }
  }

  const pw = secret?.password ?? '';
  const maskedPw = '•'.repeat(Math.min(pw.length || 8, 16));
  const totpTone = totp && totp.remaining <= 5 ? 'danger' : 'green';

  const header = (
    <div className="flex items-start gap-3 px-5 py-4 border-b border-border-subtle">
      <ServiceTile name={cred.name} size="lg" />
      <div className="flex-1 min-w-0">
        <div className="text-[1.25rem] font-bold leading-tight text-primary truncate">{cred.name}</div>
        <div className="text-[0.78rem] text-muted mt-1 truncate">{cred.url ?? '—'} · {cred.category}</div>
      </div>
      <IconButton label="닫기" variant="bordered" size="lg" onClick={onClose}><IconClose width={16} height={16} /></IconButton>
    </div>
  );

  return (
    <Modal
      open={!!cred}
      onClose={onClose}
      title={cred.name}
      header={header}
      size="sm"
      footer={
        <>
          <Button variant="danger" className="mr-auto" onClick={onDelete}>삭제</Button>
          <Button variant="ghost" onClick={onClose}>닫기</Button>
          <Button variant="ghost" onClick={onEdit}>수정</Button>
        </>
      }
    >
      <div className="flex flex-col">
        {/* 아이디 */}
        <DetailRow label="아이디">
          <span className="text-[0.9375rem] text-primary truncate">{cred.username}</span>
          <Button variant="ghost" onClick={() => copyToClipboard(cred.username)}><IconCopy />복사</Button>
        </DetailRow>

        {/* 비밀번호 — 복사는 이 창에서 유일한 주 버튼 */}
        <DetailRow label="비밀번호">
          <span className={`text-[0.9375rem] truncate ${pwVisible ? 'text-primary font-mono' : 'tracking-[0.25em] text-muted'}`}>{pwVisible ? pw : maskedPw}</span>
          <IconButton label={pwVisible ? '비밀번호 숨김' : '비밀번호 표시'} variant="bordered" size="lg" onClick={handleTogglePw} disabled={!secret}><IconEye /></IconButton>
          <Button onClick={() => copyToClipboard(pw)} disabled={!secret}><IconCopy />복사</Button>
        </DetailRow>

        {/* 2FA — 실시간 6자리 코드 + 남은 시간 */}
        {cred.has2fa && (
          <DetailRow label="2FA 코드 (TOTP)">
            <span className="text-[1.625rem] leading-[1.1] tracking-[0.08em] text-primary tabular-nums">{totp ? totp.code : '••••••'}</span>
            {totp && (
              <span className="flex items-center gap-2">
                <span className="block w-24 h-0.75 bg-elevated"><span className={`block h-full transition-[width] duration-1000 ease-linear ${totpTone === 'danger' ? 'bg-danger' : 'bg-accent'}`} style={{ width: `${(totp.remaining / (totp.period || 30)) * 100}%` }} /></span>
                <span className={`text-[0.72rem] tabular-nums ${totpTone === 'danger' ? 'text-danger' : 'text-muted'}`}>{totp.remaining}초</span>
              </span>
            )}
            <Button variant="ghost" onClick={() => totp && copyToClipboard(totp.code)} disabled={!totp}><IconCopy />복사</Button>
          </DetailRow>
        )}

        {/* 2FA 백업코드 — 분실 대비 일회용 코드 */}
        {cred.has2fa && (
          backupCodes ? (
            <div className="py-3 border-b border-border-subtle">
              <span className="text-[0.75rem] text-muted">2FA 백업코드</span>
              <div className="grid grid-cols-2 gap-1.5 mt-2 border border-border rounded-ui p-3">
                {backupCodes.map((code) => (
                  <span key={code} className="font-mono text-[0.8rem] text-primary tracking-[0.08em] text-center py-0.5">{code}</span>
                ))}
              </div>
              <div className="flex gap-2 mt-2">
                <Button variant="ghost" size="sm" className="flex-1" onClick={() => copyToClipboard(backupCodes.join('\n'))}>전체 복사</Button>
                <Button variant="ghost" size="sm" className="flex-1" onClick={handleGenBackup} disabled={backupBusy}>재생성</Button>
              </div>
            </div>
          ) : (
            <DetailRow label="2FA 백업코드">
              <span className="text-[0.84rem] text-muted">{cred.hasBackupCodes ? '백업코드가 저장되어 있습니다.' : '저장된 백업코드가 없습니다.'}</span>
              {cred.hasBackupCodes
                ? <Button variant="ghost" size="sm" onClick={handleViewBackup} disabled={backupBusy}>보기</Button>
                : <Button variant="ghost" size="sm" onClick={handleGenBackup} disabled={backupBusy}>생성</Button>}
            </DetailRow>
          )
        )}

        {/* 메모 */}
        <div className="flex flex-col gap-0.5 py-3">
          <span className="text-[0.75rem] text-muted">메모</span>
          <span className="text-[0.875rem] text-secondary leading-normal">{cred.memo || '—'}</span>
        </div>

        <div className="flex items-center gap-1.5 text-[0.72rem] text-muted [&_svg]:w-3 [&_svg]:h-3">
          <IconClock />이 창을 열면 열람이 기록됩니다 · 수정일 {fmtCredDate(cred.updatedAt)}
        </div>
      </div>
    </Modal>
  );
}

// 상세 한 줄 — 위에 라벨, 아래에 값(왼쪽)과 동작(오른쪽), 줄 사이는 머리카락 선
function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 py-3 border-b border-border-subtle">
      <span className="text-[0.75rem] text-muted">{label}</span>
      <div className="flex items-center gap-2 flex-wrap *:first:flex-1 *:first:min-w-0">{children}</div>
    </div>
  );
}
