'use client';

/**
 * 공통 확인 모달 + useConfirm 훅.
 * window.confirm() 대체 — createPortal로 body에 렌더해 z-index 문제를 방지하며
 * 백드롭 fade-in + 박스 slide-up 애니메이션을 적용한다.
 */
import { useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { IconAlertCircle, IconCheck } from './icons';
import Button from './ui/Button';

// ── ConfirmModal 컴포넌트 ──────────────────────────────────────────
interface ConfirmModalProps {
  open: boolean;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** danger: 삭제·해지 등 파괴적 액션 / primary: 복원·저장 등 */
  variant?: 'danger' | 'primary';
  /** 메시지 위 굵은 제목 */
  title?: string;
  /** 기본 아이콘(경고/체크) 대신 쓸 아이콘 */
  icon?: ReactNode;
  /** 메시지 아래 추가 내용 (입력칸 · 오류 문구 등) */
  children?: ReactNode;
  /** 다른 모달 위에 한 겹 더 띄울 때 */
  layer?: 'confirm' | 'top';
  confirmDisabled?: boolean;
  /** 진행 중이면 확인은 loadingLabel 로 바뀌고 취소는 막힌다 */
  loading?: boolean;
  loadingLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({
  open,
  message,
  confirmLabel = '확인',
  cancelLabel = '취소',
  variant = 'danger',
  title,
  icon,
  children,
  layer = 'confirm',
  confirmDisabled,
  loading,
  loadingLabel,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  if (!open) return null;

  // createPortal — body에 직접 마운트해 모달 위에도 정상 표시
  return createPortal(
    <div
      className={`fixed inset-0 bg-[rgba(0,0,0,0.52)] backdrop-blur-[3px] ${layer === 'top' ? 'z-[400]' : 'z-[300]'} flex items-center justify-center p-6 [animation:fadeIn_0.2s_ease]`}
      role="presentation"
    >
      <div
        className="bg-background border border-border rounded-2xl shadow-overlay w-full max-w-[360px] px-6 pt-8 pb-6 flex flex-col items-center gap-[18px] text-center [animation:slideUp_0.25s_ease]"
        role="alertdialog"
        aria-modal="true"
        aria-describedby="cm-msg"
      >
        {/* 아이콘 */}
        <div className={`w-[60px] h-[60px] rounded-full flex items-center justify-center shrink-0 ${variant === 'danger' ? 'bg-danger-dim text-danger' : 'bg-accent-dim text-accent'}`}>
          {icon ?? (variant === 'danger'
            ? <IconAlertCircle width={28} height={28} />
            : <IconCheck width={28} height={28} />)}
        </div>

        {/* 메시지 */}
        <div>
          {title && <p className="text-[1rem] font-bold text-primary mb-1">{title}</p>}
          <p id="cm-msg" className="text-[0.9rem] text-secondary leading-[1.65] [word-break:keep-all]">{message}</p>
        </div>
        {children}

        {/* 버튼 */}
        <div className="flex gap-2 w-full">
          <Button variant="ghost" className="flex-1" onClick={onCancel} disabled={loading}>{cancelLabel}</Button>
          <Button variant={variant === 'danger' ? 'solid-danger' : 'primary'} className="flex-1" onClick={onConfirm} disabled={confirmDisabled} loading={loading} loadingLabel={loadingLabel}>
            {confirmLabel}
          </Button>
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
