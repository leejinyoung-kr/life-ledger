'use client';

/**
 * 공통 확인 모달 + useConfirm 훅.
 * window.confirm() 대체 — createPortal로 body에 렌더해 z-index 문제를 방지하며
 * 백드롭 fade-in + 박스 slide-up 애니메이션을 적용한다.
 */
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { IconAlertCircle, IconCheck } from './icons';

// ── ConfirmModal 컴포넌트 ──────────────────────────────────────────
interface ConfirmModalProps {
  open: boolean;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** danger: 삭제·해지 등 파괴적 액션 / primary: 복원·저장 등 */
  variant?: 'danger' | 'primary';
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({
  open,
  message,
  confirmLabel = '확인',
  cancelLabel = '취소',
  variant = 'danger',
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  if (!open) return null;

  // createPortal — body에 직접 마운트해 모달 위에도 정상 표시
  return createPortal(
    <div className="cm-overlay" role="presentation">
      <div
        className="cm-box"
        role="alertdialog"
        aria-modal="true"
        aria-describedby="cm-msg"
      >
        {/* 아이콘 */}
        <div className={`cm-icon-wrap cm-icon-wrap--${variant}`}>
          {variant === 'danger'
            ? <IconAlertCircle width={28} height={28} />
            : <IconCheck width={28} height={28} />}
        </div>

        {/* 메시지 */}
        <p id="cm-msg" className="cm-msg">{message}</p>

        {/* 버튼 */}
        <div className="cm-footer">
          <button type="button" className="btn btn-ghost cm-btn" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`btn cm-btn ${variant === 'danger' ? 'btn-solid-danger' : 'btn-primary'}`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ── useConfirm 훅 ─────────────────────────────────────────────────
interface ConfirmState {
  open: boolean;
  message: string;
  variant: 'danger' | 'primary';
  resolve: ((v: boolean) => void) | null;
}

/**
 * window.confirm() 대체 훅.
 * confirm(message, variant) → Promise<boolean> 반환.
 * 반환된 confirmElement 를 컴포넌트 JSX 안에 반드시 렌더해야 한다.
 */
export function useConfirm() {
  const [state, setState] = useState<ConfirmState>({
    open: false, message: '', variant: 'danger', resolve: null,
  });

  // 확인 모달 열기 — Promise resolve 로 결과 전달
  function confirm(message: string, variant: 'danger' | 'primary' = 'danger'): Promise<boolean> {
    return new Promise((resolve) => {
      setState({ open: true, message, variant, resolve });
    });
  }

  // 모달 닫기 (확인/취소 공용)
  function close(result: boolean) {
    state.resolve?.(result);
    setState((s) => ({ ...s, open: false, resolve: null }));
  }

  const confirmElement = (
    <ConfirmModal
      open={state.open}
      message={state.message}
      variant={state.variant}
      onConfirm={() => close(true)}
      onCancel={() => close(false)}
    />
  );

  return { confirm, confirmElement };
}
