/**
 * 공통 폼 입력 그룹 + 모달 푸터 (Tailwind).
 * 여러 모달(가계부/구독/자산 등)에서 중복되던 Field/SaveFooter 를 통합한다.
 * .input 은 공통 폼 프리미티브라 globals 클래스를 그대로 쓴다.
 */
import type { ReactNode } from 'react';
import Button from './Button';

// 라벨 + 입력요소 (label 로 감싸 접근성 이름 연결). error 가 있으면 안의 .input 이 빨간 테두리가 된다
export function Field({ label, required, error, children }: { label: string; required?: boolean; error?: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5" data-invalid={error ? '' : undefined}>
      <span className="text-[0.8rem] font-medium text-secondary flex items-center gap-0.5">
        {label}{required && <span className="text-danger font-bold text-[0.85rem] leading-none">*</span>}
      </span>
      {children}
      {error && <span className="text-[0.7rem] text-danger mt-0.5 block leading-[1.4]">{error}</span>}
    </label>
  );
}

// 모달 공통 푸터 (취소/저장) — 저장 중 비활성화
export function ModalFooter({ onClose, onSave, saving, saveLabel = '저장', saveDisabled }: { onClose: () => void; onSave: () => void; saving: boolean; saveLabel?: string; saveDisabled?: boolean }) {
  return (
    <>
      <Button variant="ghost" onClick={onClose} disabled={saving}>취소</Button>
      <Button onClick={onSave} disabled={saving || saveDisabled}>{saving ? '저장 중...' : saveLabel}</Button>
    </>
  );
}
