import { useEffect, useRef } from 'react';
import Button from '@/components/ui/Button';
import { IconEdit, IconTrash, IconCopy } from '@/components/icons';
import type { TransactionType } from '@/lib/finance';

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

export const TABLE_CARD = 'bg-background border border-border rounded-[var(--radius-lg)] shadow-[var(--shadow-sm)] overflow-hidden';
export const TXCARDS = 'hidden max-md:flex flex-col gap-2.5 p-3';
export const TXCARD = 'border border-border rounded-[var(--radius-lg)] p-3.5 bg-background';
export const TXCARD_TOP = 'flex justify-between items-baseline gap-2.5';
export const TXCARD_TITLE = 'font-semibold text-[0.95rem] break-all';
export const TXCARD_AMT = 'font-bold text-base whitespace-nowrap [font-family:var(--font-mono)]';
export const TXCARD_SUB = 'mt-2 text-[0.78rem] text-secondary flex flex-wrap items-center gap-1.5';
export const TXCARD_EMPTY = 'text-center text-muted py-7';

export const AMT_COLOR: Record<TransactionType, string> = {
  income: 'text-accent',
  expense: 'text-danger',
  transfer: 'text-blue',
};

export function toDay(): string { return new Date().toISOString().slice(0, 10); }

export function monthsAgo(n: number): string {
  const d = new Date(); d.setMonth(d.getMonth() - n); return d.toISOString().slice(0, 10);
}

export function RowActions({ onEdit, onDelete, onCopy }: { onEdit: () => void; onDelete: () => void; onCopy?: () => void }) {
  return (
    <div className="flex justify-center gap-1">
      {onCopy && <button type="button" className="icon-btn-bordered" onClick={onCopy} aria-label="복사"><IconCopy width={14} height={14} /></button>}
      <button type="button" className="icon-btn-bordered" onClick={onEdit} aria-label="수정"><IconEdit width={14} height={14} /></button>
      <button type="button" className="icon-btn-danger" onClick={onDelete} aria-label="삭제"><IconTrash width={14} height={14} /></button>
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
