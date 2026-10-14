'use client';

import { useEffect, useState } from 'react';
import { useApiQuery } from '@/lib/query';
import { qk } from '@/lib/queryKeys';
import { clearVaultToken, getVaultRemainingMs, requestVaultUnlock } from '@/lib/vault';
import type { VaultStatus } from '@/lib/security';
import Button from '@/components/ui/Button';
import { IconLock, IconUnlock } from '@/components/icons';

// 보관함 잠금 띠 — 마스터 잠금이 꺼짐 / 잠김 / 풀림 중 어느 쪽인지 보여 주고 풀기 · 잠그기를 한다
export default function VaultStrip() {
  const statusQuery = useApiQuery<VaultStatus>(qk.security.vault(), '/security/vault');
  const [remainMs, setRemainMs] = useState(() => getVaultRemainingMs());
  const unlocked = remainMs > 0;

  // 토큰은 메모리에만 있고 만료도 시간 경과로 일어나므로 1초마다 남은 시간을 다시 읽는다
  useEffect(() => {
    const iv = setInterval(() => setRemainMs(getVaultRemainingMs()), 1000);
    return () => clearInterval(iv);
  }, []);

  const status = statusQuery.data;
  if (!status) return null;

  if (!status.enabled) {
    return (
      <Strip tone="off" icon={<IconUnlock />} title="마스터 잠금이 꺼져 있습니다" sub="비밀번호와 2FA 시크릿을 열 때 마스터 비밀번호를 묻지 않습니다.">
        <Button variant="ghost" size="sm" href="/security">보안에서 잠금 켜기</Button>
      </Strip>
    );
  }

  if (unlocked) {
    return (
      <Strip
        tone="open"
        icon={<IconUnlock />}
        title="보관함 잠금이 풀려 있습니다"
        sub={`${formatRemain(remainMs)} 뒤 다시 잠깁니다.`}
      >
        <Button variant="ghost" onClick={() => { clearVaultToken(); setRemainMs(0); }}><IconLock />지금 잠그기</Button>
      </Strip>
    );
  }

  return (
    <Strip tone="locked" icon={<IconLock />} title="보관함이 잠겨 있습니다" sub="비밀번호나 2FA 시크릿을 열 때 마스터 비밀번호를 묻습니다.">
      <Button variant="ghost" onClick={() => { requestVaultUnlock().then((ok) => { if (ok) setRemainMs(getVaultRemainingMs()); }); }}><IconUnlock />잠금 풀기</Button>
    </Strip>
  );
}

// 남은 시간 'm분 ss초'
function formatRemain(ms: number): string {
  const sec = Math.ceil(ms / 1000);
  const m = Math.floor(sec / 60);
  return m > 0 ? `${m}분 ${String(sec % 60).padStart(2, '0')}초` : `${sec}초`;
}

const TONE = {
  open: { box: 'border-accent', icon: 'border-accent text-accent-dark' },
  locked: { box: 'border-border', icon: 'border-border text-muted' },
  off: { box: 'border-border', icon: 'border-border text-muted' },
} as const;

// 잠금 띠의 틀 — 둥근 아이콘 · 제목과 설명 · 오른쪽 동작
function Strip({ tone, icon, title, sub, children }: { tone: keyof typeof TONE; icon: React.ReactNode; title: string; sub: string; children: React.ReactNode }) {
  return (
    <div className={`flex items-center gap-3.5 flex-wrap px-4 py-3 mb-4 border rounded-ui ${TONE[tone].box}`}>
      <span className={`w-9 h-9 shrink-0 rounded-full border grid place-items-center [&_svg]:w-[18px] [&_svg]:h-[18px] ${TONE[tone].icon}`}>{icon}</span>
      <div className="flex-1 basis-55 flex flex-col leading-[1.4]">
        <span className="font-semibold text-[0.875rem] text-primary">{title}</span>
        <span className="text-[0.78rem] text-muted">{sub}</span>
      </div>
      {children}
    </div>
  );
}
