'use client';

/**
 * 보안 설정 — 세션 자동 만료 행(SessionExpiryRow) · 보관함 잠금 그룹(비밀번호 자동 숨김 · 마스터 잠금 설정/해제).
 * 설정 화면의 보안 탭에 있던 것을 보안 화면으로 옮겼다. 설정값은 /settings, 잠금은 /security/vault 와 연동한다.
 */
import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { notify } from '@/lib/toast';
import { useApiQuery, useInvalidate } from '@/lib/query';
import { qk } from '@/lib/queryKeys';
import { clearVaultToken } from '@/lib/vault';
import { useSettingsPatch } from '@/lib/useSettingsPatch';
import { SESSION_EXPIRY_OPTIONS, PW_AUTO_HIDE_OPTIONS, type Settings } from '@/lib/settings';
import type { VaultStatus } from '@/lib/security';
import { SettingGroup, SettingRow } from '@/components/SettingGroup';
import { IconLock } from '@/components/icons';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';

// 자동잠금 시간 옵션 (분)
const VAULT_TIMEOUT_OPTIONS = [
  { value: 0, label: '수동 잠금만' },
  { value: 5, label: '5분' },
  { value: 15, label: '15분' },
  { value: 30, label: '30분' },
  { value: 60, label: '1시간' },
];

// 세션 자동 만료 선택 행 — 로그인 기기 카드 맨 아래에 놓는다
export function SessionExpiryRow() {
  const patch = useSettingsPatch();
  const s = useApiQuery<Settings>(qk.settings.detail(), '/settings').data ?? null;
  return (
    <SettingRow label="세션 자동 만료" desc="비활성 시간 후 자동 로그아웃">
      <select className="input w-auto" aria-label="세션 자동 만료" value={s?.sessionExpiry ?? '7d'} disabled={!s} onChange={(e) => patch({ sessionExpiry: e.target.value })}>
        {SESSION_EXPIRY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </SettingRow>
  );
}

// 보관함 잠금 그룹 — 암호화 방식 · 비밀번호 자동 숨김 · 마스터 잠금
export default function SecuritySettings() {
  const patch = useSettingsPatch();
  const invalidate = useInvalidate();
  const s = useApiQuery<Settings>(qk.settings.detail(), '/settings').data ?? null;

  // 마스터 잠금
  const [vault, setVault] = useState<VaultStatus | null>(null);
  const [vaultPw, setVaultPw] = useState('');
  const [vaultTimeout, setVaultTimeout] = useState(5);
  const [vaultSaving, setVaultSaving] = useState(false);

  // 마스터 잠금 상태 로드
  const loadVault = useCallback(async () => {
    try {
      const v = await api.get<VaultStatus>('/security/vault');
      setVault(v);
      setVaultTimeout(v.timeoutMin);
    } catch { /* 무시 */ }
  }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- 마운트 시 잠금 상태 조회
  useEffect(() => { loadVault(); }, [loadVault]);

  // 마스터 잠금 설정/변경
  async function handleSetupVault() {
    if (!vaultPw || vaultSaving) return;
    setVaultSaving(true);
    try {
      await api.post('/security/vault/setup', { password: vaultPw, timeoutMin: vaultTimeout });
      setVaultPw('');
      notify.success('마스터 잠금을 설정했습니다.');
      loadVault();
      invalidate(qk.security.vault());
    } catch (e) { notify.error((e as Error).message); }
    finally { setVaultSaving(false); }
  }

  // 마스터 잠금 해제(비활성화) — 현재 비번 확인
  async function handleDisableVault() {
    if (!vaultPw || vaultSaving) return;
    setVaultSaving(true);
    try {
      await api.post('/security/vault/disable', { password: vaultPw });
      setVaultPw('');
      clearVaultToken();
      notify.success('마스터 잠금을 해제했습니다.');
      loadVault();
      invalidate(qk.security.vault());
    } catch (e) { notify.error((e as Error).message); }
    finally { setVaultSaving(false); }
  }

  return (
    <SettingGroup title="보관함 잠금">
      <SettingRow label="암호화 방식" desc="계정 보관함 비밀번호 · 2FA 시크릿 암호화 알고리즘">
        <Badge tone="neutral">AES-256-GCM</Badge>
      </SettingRow>
      <SettingRow label="비밀번호 자동 숨김" desc="상세 창에서 비밀번호를 보인 뒤 다시 가리기까지">
        <select className="input w-auto" aria-label="비밀번호 자동 숨김" value={s?.pwAutoHide ?? '10s'} disabled={!s} onChange={(e) => patch({ pwAutoHide: e.target.value })}>
          {PW_AUTO_HIDE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </SettingRow>

      {/* 마스터 잠금 — Google 로그인 외 보관함 2차 잠금 */}
      <div className="flex flex-col gap-2.5 px-4.5 py-3.5 border-t border-border-subtle sm:flex-row sm:items-center sm:justify-between sm:gap-6">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-[0.875rem] font-medium text-primary">마스터 잠금</span>
            <Badge tone={vault?.enabled ? 'success' : 'warning'}>{vault?.enabled ? '사용 중' : '미설정'}</Badge>
          </div>
          <div className="text-[0.78rem] text-muted break-keep">
            켜두면 비밀번호를 열람할 때마다 마스터 비밀번호가 필요합니다.
          </div>
          {vault?.enabled && (
            <div className="text-[0.78rem] text-muted mt-1">자동 잠금 {vault.timeoutMin > 0 ? `${vault.timeoutMin}분` : '수동'} · 바꾸려면 끈 뒤 다시 켜세요.</div>
          )}
        </div>
        <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:shrink-0">
          <input
            type="password"
            className="input sm:w-56"
            placeholder={vault?.enabled ? '현재 마스터 비밀번호' : '새 마스터 비밀번호 (8자 이상)'}
            value={vaultPw}
            onChange={(e) => setVaultPw(e.target.value)}
            aria-label="마스터 비밀번호"
          />
          <div className="flex items-center gap-1.5">
            {!vault?.enabled && (
              <select className="input w-auto" aria-label="자동잠금 시간" value={vaultTimeout} onChange={(e) => setVaultTimeout(Number(e.target.value))}>
                {VAULT_TIMEOUT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            )}
            {vault?.enabled
              ? <Button variant="danger" disabled={vaultSaving || !vaultPw} onClick={handleDisableVault}>잠금 끄기</Button>
              : <Button disabled={vaultSaving || !vaultPw} onClick={handleSetupVault}><IconLock />잠금 켜기</Button>}
          </div>
        </div>
      </div>
      <div className="px-4.5 pb-3 text-[0.78rem] text-muted">
        기능을 켜고 끄는 것은 <b className="font-semibold text-primary">잠금 켜기 · 끄기</b>, 잠긴 보관함을 여는 것은 <b className="font-semibold text-primary">잠금 풀기</b>.
      </div>
    </SettingGroup>
  );
}
