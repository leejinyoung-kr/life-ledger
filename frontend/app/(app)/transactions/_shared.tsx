import { useEffect, useRef } from 'react';
import Button from '@/components/ui/Button';
import IconButton from '@/components/ui/IconButton';
import { IconEdit, IconTrash, IconCopy } from '@/components/icons';
import { localDate, type TransactionType } from '@/lib/finance';

// 상단 "추가" 버튼 클릭 횟수(addTrigger)가 바뀌면 추가 모달을 연다.
// 탭은 마운트된 채 숨겨졌다 다시 보이므로, 부모가 넘기는 카운터 변화로 추가 동작을 트리거한다.
export function useAddTrigger(addTrigger: number, onTrigger: () => void) {
  const prev = useRef(addTrigger);
  useEffect(() => {
    if (addTrigger !== prev.current) {
      prev.current = addTrigger;
      onTrigger();
    }
    // onTrigger 는 매 렌더 새로 생성되므로 의존성에서 제외 (addTrigger 변화에만 반응)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addTrigger]);
}

export const TXCARDS = 'hidden max-md:flex flex-col gap-2.5 p-3';
export const TXCARD = 'border border-border rounded-panel p-3.5 bg-background';
export const TXCARD_TOP = 'flex justify-between items-baseline gap-2.5';
export const TXCARD_TITLE = 'font-semibold text-[0.95rem] break-all';
export const TXCARD_AMT = 'font-bold text-base whitespace-nowrap [font-family:var(--font-mono)]';
export const TXCARD_SUB = 'mt-2 text-[0.78rem] text-secondary flex flex-wrap items-center gap-1.5';

export const AMT_COLOR: Record<TransactionType, string> = {
  income: 'text-accent',
  expense: 'text-danger',
  transfer: 'text-blue',
};

export function toDay(): string { return localDate(); }

export function monthsAgo(n: number): string {
  const d = new Date(); d.setMonth(d.getMonth() - n); return localDate(d);
}

export function RowActions({ onEdit, onDelete, onCopy }: { onEdit: () => void; onDelete: () => void; onCopy?: () => void }) {
  return (
    <div className="flex justify-center gap-1">
      {onCopy && <IconButton label="복사" variant="bordered" onClick={onCopy}><IconCopy width={14} height={14} /></IconButton>}
      <IconButton label="수정" variant="bordered" onClick={onEdit}><IconEdit width={14} height={14} /></IconButton>
      <IconButton label="삭제" variant="danger" onClick={onDelete}><IconTrash width={14} height={14} /></IconButton>
    </div>
  );
}

export function CardActions({ onEdit, onDelete, onCopy }: { onEdit: () => void; onDelete: () => void; onCopy?: () => void }) {
  return (
    <div className="flex gap-2 mt-3">
      {onCopy && <Button variant="ghost" className="flex-1" onClick={onCopy}>복사</Button>}
      <Button variant="ghost" className="flex-1" onClick={onEdit}>수정</Button>
      <Button variant="danger" className="flex-1" onClick={onDelete}>삭제</Button>
    </div>
  );
}
