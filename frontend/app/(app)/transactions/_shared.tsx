import Button from '@/components/ui/Button';
import { IconEdit, IconTrash } from '@/components/icons';
import type { TransactionType } from '@/lib/finance';

export const TABLE_CARD = 'bg-background border border-border rounded-[var(--radius-lg)] shadow-[var(--shadow-sm)] overflow-hidden';
export const TXCARDS = 'hidden max-md:flex flex-col gap-2.5 p-3';
export const TXCARD = 'border border-border rounded-[var(--radius-lg)] p-3.5 bg-background';
export const TXCARD_TOP = 'flex justify-between items-baseline gap-2.5';
export const TXCARD_TITLE = 'font-semibold text-[0.95rem] break-all';
export const TXCARD_AMT = 'font-bold text-base whitespace-nowrap [font-family:var(--font-mono)]';
export const TXCARD_SUB = 'mt-2 text-[0.78rem] text-secondary flex flex-wrap items-center gap-1.5';
export const TXCARD_EMPTY = 'text-center text-muted py-7';
export const ICON_BTN = 'w-[34px] h-[34px] inline-flex items-center justify-center rounded-[var(--radius)] transition-all';

export const AMT_COLOR: Record<TransactionType, string> = {
  income: 'text-accent',
  expense: 'text-danger',
  transfer: 'text-blue',
};

export function toDay(): string { return new Date().toISOString().slice(0, 10); }

export function monthsAgo(n: number): string {
  const d = new Date(); d.setMonth(d.getMonth() - n); return d.toISOString().slice(0, 10);
}

export function RowActions({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="flex justify-center gap-1">
      <button type="button" className={`${ICON_BTN} text-secondary border border-border hover:bg-surface hover:text-primary`} onClick={onEdit} aria-label="수정"><IconEdit width={14} height={14} /></button>
      <button type="button" className={`${ICON_BTN} bg-danger-dim text-danger hover:bg-[rgba(240,68,56,0.15)]`} onClick={onDelete} aria-label="삭제"><IconTrash width={14} height={14} /></button>
    </div>
  );
}

export function CardActions({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="flex gap-2 mt-3">
      <Button variant="ghost" className="flex-1" onClick={onEdit}><IconEdit width={14} height={14} /> 수정</Button>
      <Button variant="danger" className="flex-1" onClick={onDelete}><IconTrash width={14} height={14} /> 삭제</Button>
    </div>
  );
}
