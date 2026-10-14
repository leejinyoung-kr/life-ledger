/**
 * 흰 카드 목록 맨 위 전체선택 줄 — 옅은 바탕에 체크박스 + '전체선택' / 'n건 선택됨'.
 * 알림 목록 · 휴대폰 카드 목록(MobileCardList)이 같이 쓴다.
 */

// 전체선택 체크박스 줄
export default function SelectAllBar({ checked, onToggle, count }: {
  checked: boolean;
  onToggle: () => void;
  /** 고른 개수 — 0 이면 '전체선택' 글자 */
  count: number;
}) {
  return (
    <label className="flex items-center gap-3 h-10 px-4 bg-surface border-b border-border text-[0.78rem] text-muted cursor-pointer">
      <input type="checkbox" className="checkbox" checked={checked} onChange={onToggle} aria-label="전체선택" />
      {count > 0 ? `${count}건 선택됨` : '전체선택'}
    </label>
  );
}
