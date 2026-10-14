import { useEffect, useRef } from 'react';
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

export const AMT_COLOR: Record<TransactionType, string> = {
  income: 'text-success',
  expense: 'text-danger',
  transfer: 'text-blue',
};

export function toDay(): string { return localDate(); }

export function monthsAgo(n: number): string {
  const d = new Date(); d.setMonth(d.getMonth() - n); return localDate(d);
}
