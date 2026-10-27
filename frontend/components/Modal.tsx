'use client';

/**
 * 공통 모달 (Tailwind).
 * 닫기 버튼 / Esc 로만 닫힌다. 오버레이 클릭은 의도치 않은 닫힘 방지를 위해 비활성화.
 * 본문·푸터는 children/footer 로 주입.
 */
import { useEffect, useRef, type ReactNode } from 'react';
import { IconClose } from './icons';
import IconButton from './ui/IconButton';

interface ModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** 하단 액션 영역 (취소/저장 버튼 등) */
  footer?: ReactNode;
  /** 기본 헤더(제목+닫기) 대신 렌더링할 커스텀 헤더 */
  header?: ReactNode;
  /** 기본 헤더의 제목 아래 보조 문구 */
  subtitle?: string;
  /** 기본 헤더에서 닫기 버튼 왼쪽에 놓는 요소 (배지 등) */
  headerAction?: ReactNode;
  /** 박스 너비: sm 380px · md 520px(기본) · lg 720px — 휴대폰에서는 양옆 16px 여백을 두고 가운데 뜬다 */
  size?: 'sm' | 'md' | 'lg';
}

const SIZE = { sm: 'max-w-[380px]', md: 'max-w-[520px]', lg: 'max-w-[720px]' } as const;

export default function Modal({ open, title, onClose, children, footer, header, subtitle, headerAction, size = 'md' }: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  // onClose 는 부모에서 매 렌더마다 새로 생성되는 인라인 함수일 수 있어 ref 로 최신값만 참조
  // (deps 에 그대로 넣으면 입력창 타이핑마다 effect 가 재실행되어 포커스가 되돌아감)
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // 포커스 가능한 요소 목록 조회 (disabled·숨김 제외)
  function focusables(dialog: HTMLDivElement | null) {
    return Array.from(
      dialog?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ) ?? [],
    ).filter((el) => el.offsetParent !== null);
  }

  // 열릴 때 1회만 첫 포커스 가능한 요소로 이동 + 닫힐 때 트리거 요소로 포커스 복귀
  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    const prevFocused = document.activeElement as HTMLElement | null;
    focusables(dialog)[0]?.focus();

    return () => {
      if (prevFocused?.isConnected) prevFocused.focus();
      // 연 요소가 다시 그려졌거나 포커스를 못 받는 요소(목록 행 등)면 포커스가 닫힌(가려진) 창 안에 남는다 — 창 밖으로 뺀다
      const active = document.activeElement as HTMLElement | null;
      if (active && dialog?.contains(active)) active.blur();
    };
  }, [open]);

  // Esc 로 닫기 + Tab 포커스 트랩(모달 밖으로 포커스 이탈 방지)
  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab') return;
      const items = focusables(dialog);
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement as HTMLElement | null;
      // Shift+Tab 이 첫 요소를 넘어가거나, Tab 이 마지막을 넘어가면 반대편으로 순환
      if (e.shiftKey && (active === first || !dialog?.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    // 오버레이 클릭으로 닫히지 않음 — 폼 입력 중 실수 방지
    // 닫혀 있을 때는 접근성 트리에서 제외 + 포커스/상호작용 차단 (ghost dialog 방지)
    <div
      className={`fixed inset-0 bg-backdrop z-[200] flex items-center justify-center p-6 max-md:p-4 transition-opacity ${open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
      aria-hidden={!open}
      inert={!open}
    >
      <div
        ref={dialogRef}
        className={`bg-background border border-border rounded-panel w-full ${SIZE[size]} shadow-overlay max-h-[calc(100dvh-48px)] flex flex-col max-md:max-h-[calc(100dvh-32px)] ${open ? '[animation:slideUp_0.25s_ease]' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        {header ?? (
          <div className="flex items-start gap-3 px-5 py-4 border-b border-border-subtle">
            <div className="flex-1 min-w-0">
              <div className="text-[1.25rem] font-bold leading-tight text-primary">{title}</div>
              {subtitle && <div className="text-[0.78rem] text-muted mt-1">{subtitle}</div>}
            </div>
            {headerAction}
            <IconButton label="닫기" variant="bordered" size="lg" onClick={onClose}>
              <IconClose width={16} height={16} />
            </IconButton>
          </div>
        )}
        <div className="px-5 py-[18px] flex flex-col gap-4 overflow-y-auto">{children}</div>
        {footer && <div className="px-5 py-3.5 flex gap-2 justify-end border-t border-border-subtle">{footer}</div>}
      </div>
    </div>
  );
}
