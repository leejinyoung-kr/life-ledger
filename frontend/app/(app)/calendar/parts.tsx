/**
 * 캘린더 전용 작은 요소 — 유형 표식 · 그리드 칩 스타일 · 알림 체크.
 * 유형은 색만이 아니라 모양으로도 구분한다 (구독 결제 채운 원 · 입금/만기 네모 · 서류 만료 마름모 · 할일 빈 원 · 공휴일 빨간 빈 원).
 */
import { IconBell } from '@/components/icons';
import type { EvType } from '@/lib/calendar';

// 유형별 표식 모양 (md 9px / sm 5px — 휴대폰 날짜 칸의 점)
const MARK: Record<EvType, { md: string; sm: string }> = {
  pay: { md: 'rounded-full bg-danger border-[1.5px] border-danger', sm: 'rounded-full bg-danger border border-danger' },
  due: { md: 'border-[1.5px] border-blue', sm: 'border border-blue' },
  exp: { md: 'rotate-45 scale-[.85] border-[1.5px] border-warning', sm: 'rotate-45 border border-warning' },
  task: { md: 'rounded-full border-[1.5px] border-primary', sm: 'rounded-full border border-primary' },
  holiday: { md: 'rounded-full border-[1.5px] border-danger', sm: 'rounded-full border border-danger' },
};

// 유형 표식 한 개 (범례 · 목록 · 폼 · 상세 머리 · 휴대폰 점 공용)
export function TypeMark({ type, size = 'md' }: { type: EvType; size?: 'md' | 'sm' }) {
  const dim = size === 'md' ? 'w-[9px] h-[9px]' : 'w-[5px] h-[5px]';
  return <span aria-hidden className={`${dim} shrink-0 inline-block ${MARK[type][size]}`} />;
}

// 그리드 칩 색 — 유형 색 글자 + 같은 색 옅은 바탕 (공휴일은 바탕 없이 빨간 글자만). 연동 여부는 호출부의 연결 아이콘으로 구분한다
export const CHIP_TONE: Record<EvType, string> = {
  pay: 'bg-danger-dim text-danger',
  due: 'bg-blue-dim text-blue',
  exp: 'bg-amber-dim text-warning',
  task: 'bg-elevated text-primary',
  holiday: 'text-danger',
};

// 당일 오전 9시 알림(푸시) 체크 — 한 건 추가 · 일괄 추가 창 공용
export function NotifyCheckbox({ checked, onChange }: { checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 min-h-8 text-[0.84rem] text-secondary cursor-pointer">
      <input type="checkbox" className="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <IconBell width={14} height={14} className="text-muted" />
      당일 오전 9시에 알림 (푸시)
    </label>
  );
}
