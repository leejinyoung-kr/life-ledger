'use client';

/**
 * 공통 모달.
 * 닫기 버튼 / Esc 로만 닫힌다. 오버레이 클릭은 의도치 않은 닫힘 방지를 위해 비활성화.
 * 본문·푸터는 children/footer 로 주입.
 */
import { useEffect, type ReactNode } from 'react';
import { IconClose } from './icons';

interface ModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** 하단 액션 영역 (취소/저장 버튼 등) */
  footer?: ReactNode;
  /** 기본 헤더(제목+닫기) 대신 렌더링할 커스텀 헤더 */
  header?: ReactNode;
  /** 모달 박스 추가 className (예: 좁은 상세 모달) */
  className?: string;
}

export default function Modal({ open, title, onClose, children, footer, header, className }: ModalProps) {
  // 열려 있을 때 Esc 로 닫기
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    // 오버레이 클릭으로 닫히지 않음 — 폼 입력 중 실수 방지
    <div className={`modal-overlay${open ? ' open' : ''}`}>
      <div className={`modal${className ? ` ${className}` : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        {header ?? (
          <div className="modal-header">
            <span className="modal-title">{title}</span>
            <button type="button" className="btn btn-ghost btn-icon" onClick={onClose} aria-label="닫기">
              <IconClose width={16} height={16} />
            </button>
          </div>
        )}
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}
