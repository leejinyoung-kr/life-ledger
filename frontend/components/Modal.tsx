'use client';

/**
 * 공통 모달 (Tailwind).
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
    <div className={`fixed inset-0 bg-[rgba(15,25,35,0.45)] backdrop-blur-[4px] z-[200] flex items-center justify-center p-6 transition-opacity ${open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
      <div
        className={`bg-background border border-border rounded-2xl w-full max-w-[480px] shadow-[var(--shadow-lg)] max-h-[calc(100vh-48px)] flex flex-col ${open ? '[animation:slideUp_0.25s_ease]' : ''} ${className ?? ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        {header ?? (
          <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-border">
            <span className="[font-family:var(--font-display)] text-base font-bold text-primary">{title}</span>
            <button
              type="button"
              className="w-[34px] h-[34px] inline-flex items-center justify-center rounded-[var(--radius)] text-secondary border border-border transition-all hover:bg-surface hover:text-primary"
              onClick={onClose}
              aria-label="닫기"
            >
              <IconClose width={16} height={16} />
            </button>
          </div>
        )}
        <div className="p-6 flex flex-col gap-4 overflow-y-auto">{children}</div>
        {footer && <div className="px-6 pt-4 pb-6 flex gap-2.5 justify-end border-t border-border">{footer}</div>}
      </div>
    </div>
  );
}
