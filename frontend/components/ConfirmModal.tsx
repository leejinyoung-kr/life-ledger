'use client';

/**
 * 공통 확인 모달 + useConfirm 훅.
 * window.confirm() 대체 — createPortal로 body에 렌더해 z-index 문제를 방지하며
 * 백드롭 fade-in + 박스 slide-up 애니메이션을 적용한다.
 */
import { useEffect, useState, type ReactNode } from 'react';
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
  // Esc 로 취소 — 다른 모달 위에 떠 있을 때 그 모달까지 닫히지 않게 먼저(capture) 받아 멈춘다
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || loading) return;
      e.stopPropagation();
      onCancel();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open, loading, onCancel]);

  if (!open) return null;

  // 제목이 없으면 메시지의 첫 물음(…할까요?)을 제목으로, 나머지를 설명으로 나눈다
  const q = message.indexOf('?');
  const head = title ?? (q >= 0 ? message.slice(0, q + 1) : message);
  const body = title ? message : (q >= 0 ? message.slice(q + 1).trim() : '');

  // createPortal — body에 직접 마운트해 모달 위에도 정상 표시
  return createPortal(
    <div
      className={`fixed inset-0 bg-backdrop ${layer === 'top' ? 'z-[400]' : 'z-[300]'} flex items-center justify-center p-6 [animation:fadeIn_0.2s_ease]`}
      role="presentation"
    >
      <div
        className="bg-background border border-border rounded-panel shadow-overlay w-full max-w-[380px] flex flex-col [animation:slideUp_0.25s_ease]"
        role="alertdialog"
        aria-modal="true"
        aria-describedby="cm-msg"
      >
        {/* 제목(아이콘 + 물음) + 설명 */}
        <div className="px-5 pt-5 pb-1.5 flex flex-col gap-1.5">
          <p className="flex items-start gap-2 text-[1.0625rem] font-bold leading-snug text-primary break-keep">
            <span className={`inline-flex shrink-0 mt-0.5 [&_svg]:w-4.5 [&_svg]:h-4.5 ${variant === 'danger' ? 'text-danger' : 'text-accent-dark'}`}>
              {icon ?? (variant === 'danger' ? <IconAlertCircle /> : <IconCheck />)}
            </span>
            <span id={body ? undefined : 'cm-msg'}>{head}</span>
          </p>
          {body && <p id="cm-msg" className="pl-6.5 text-[0.84rem] text-muted leading-[1.6] break-keep">{body}</p>}
        </div>
        {children && <div className="px-5 pt-2.5 flex flex-col gap-2">{children}</div>}

        {/* 버튼 — 오른쪽 취소 · 확인 */}
        <div className="px-5 py-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel} disabled={loading}>{cancelLabel}</Button>
          <Button variant={variant === 'danger' ? 'solid-danger' : 'primary'} onClick={onConfirm} disabled={confirmDisabled} loading={loading} loadingLabel={loadingLabel}>
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
  confirmLabel?: string;
  resolve: ((v: boolean) => void) | null;
}

/**
 * window.confirm() 대체 훅.
 * confirm(message, variant, confirmLabel) → Promise<boolean> 반환. 버튼 이름 기본값은 위험이면 '삭제', 아니면 '확인'.
 * 반환된 confirmElement 를 컴포넌트 JSX 안에 반드시 렌더해야 한다.
 */
export function useConfirm() {
  const [state, setState] = useState<ConfirmState>({
    open: false, message: '', variant: 'danger', resolve: null,
  });

  // 확인 모달 열기 — Promise resolve 로 결과 전달. 버튼에는 실제 동작 이름(삭제 · 해지 · 로그아웃 …)을 쓴다
  function confirm(message: string, variant: 'danger' | 'primary' = 'danger', confirmLabel?: string): Promise<boolean> {
    return new Promise((resolve) => {
      setState({ open: true, message, variant, confirmLabel: confirmLabel ?? (variant === 'danger' ? '삭제' : '확인'), resolve });
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
      confirmLabel={state.confirmLabel}
      onConfirm={() => close(true)}
      onCancel={() => close(false)}
    />
  );

  return { confirm, confirmElement };
}
