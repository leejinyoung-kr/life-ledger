import { IS_DEMO, DEMO_VAULT_PASSWORD } from '@/lib/demo';
import { IconInfo } from './icons';

// 데모 계정 표시 띠 — 데모 빌드에서만 화면 맨 위에 보인다(점검 문서 §5-4). 운영 빌드에서는 아무것도 그리지 않는다
export default function DemoBand() {
  if (!IS_DEMO) return null;
  return (
    <div role="note" className="flex items-center gap-2 flex-wrap px-8 max-md:px-4 py-2 bg-accent-dim border-b border-accent/30 text-[0.78rem] text-accent-dark">
      <IconInfo width={14} height={14} className="shrink-0" />
      <span className="font-medium">데모 계정으로 둘러보는 중입니다.</span>
      <span>샘플 데이터이며 매일 새벽 4시에 처음 상태로 돌아갑니다. 보관함 마스터 비밀번호는 <b className="font-semibold tabular-nums">{DEMO_VAULT_PASSWORD}</b> 입니다.</span>
    </div>
  );
}
