/**
 * 목록 맨 위 전체선택 줄 — 옅은 바탕에 체크박스 + '전체선택' / 'n건 선택됨'.
 * 흰 카드 머리로 쓸 때는 아래 선만, 휴대폰 카드 목록처럼 홀로 놓일 때는 boxed 로 테두리 상자.
 */

// 전체선택 체크박스 줄
export default function SelectAllBar({ checked, onToggle, count, boxed = false }: {
  checked: boolean;
  onToggle: () => void;
  /** 고른 개수 — 0 이면 '전체선택' 글자 */
  count: number;
  boxed?: boolean;
}) {
  return (
    <label className={`flex items-center gap-3 h-10 px-4 bg-surface text-[0.78rem] text-muted cursor-pointer ${boxed ? 'border border-border rounded-panel' : 'border-b border-border'}`}>
      <input type="checkbox" className="checkbox" checked={checked} onChange={onToggle} aria-label="전체선택" />
      {count > 0 ? `${count}건 선택됨` : '전체선택'}
    </label>
  );
}
