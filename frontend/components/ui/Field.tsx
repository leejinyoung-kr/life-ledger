/**
 * 공통 폼 입력 그룹 + 모달 푸터 (Tailwind).
 * 여러 모달(가계부/구독/자산 등)에서 중복되던 Field/SaveFooter 를 통합한다.
 * .input 은 공통 폼 프리미티브라 globals 클래스를 그대로 쓴다.
 */
import type { ReactNode } from 'react';
import { AlertCircle } from 'lucide-react';
import Button from './Button';

// 라벨 + 입력요소 (label 로 감싸 접근성 이름 연결). error 가 있으면 안의 .input 이 빨간 테두리가 된다
export function Field({ label, required, error, children }: { label: string; required?: boolean; error?: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5" data-invalid={error ? '' : undefined}>
      <span className="text-[0.78rem] text-muted flex items-center gap-1">
        {label}{required && <span className="text-danger">*</span>}
      </span>
      {children}
      {error && <span className="text-[0.75rem] text-danger flex items-center gap-1.5 leading-[1.4]"><AlertCircle size={13} className="shrink-0" aria-hidden />{error}</span>}
    </label>
  );
}

// 모달 공통 푸터 (취소/저장) — 저장 중 비활성화
export function ModalFooter({ onClose, onSave, saving, saveLabel = '저장', saveDisabled }: { onClose: () => void; onSave: () => void; saving: boolean; saveLabel?: string; saveDisabled?: boolean }) {
  return (
    <>
      <Button variant="ghost" onClick={onClose} disabled={saving}>취소</Button>
      <Button onClick={onSave} disabled={saveDisabled} loading={saving} loadingLabel="저장 중...">{saveLabel}</Button>
    </>
  );
}
