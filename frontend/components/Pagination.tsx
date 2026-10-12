'use client';

/**
 * 공통 페이지네이션 컴포넌트 (Tailwind).
 * - Pagination: 하단 페이지 번호 내비게이션
 * - LimitSelect: 상단 오른쪽에 배치하는 "n개씩 보기" 선택박스
 */

const LIMIT_OPTIONS = [10, 20, 30];

// 기본(hover 없음) + 비활성 hover 분리 — 활성 버튼 hover 색 충돌 방지
const PAG_BASE = 'min-w-8 h-8 px-1.5 rounded-ui text-[0.85rem] font-medium flex items-center justify-center transition-all disabled:opacity-30 disabled:cursor-not-allowed';
const PAG_HOVER = 'text-secondary enabled:hover:bg-surface enabled:hover:text-primary';

// ── 페이지 번호 내비게이션 ────────────────────────────────────────
interface PaginationProps {
  page: number;
  totalPages: number;
  totalItems: number;
  onPageChange: (page: number) => void;
}

export default function Pagination({ page, totalPages, totalItems, onPageChange }: PaginationProps) {
  if (totalItems === 0 || totalPages <= 1) return null;

  const pages = buildPageRange(page, totalPages);

  return (
    <div className="flex items-center justify-center gap-3 px-5 py-3.5 border-t border-border-subtle">
      <div className="flex items-center gap-[3px]">
        <PagBtn disabled={page === 1} onClick={() => onPageChange(page - 1)}>‹</PagBtn>

        {pages.map((p, i) =>
          p === '...'
            ? <span key={`el-${i}`} className="min-w-7 text-center text-muted text-[0.85rem] leading-8">…</span>
            : (
              <button
                key={p}
                type="button"
                className={`${PAG_BASE} ${page === p ? 'bg-accent text-white enabled:hover:bg-accent-dark' : PAG_HOVER}`}
                onClick={() => onPageChange(Number(p))}
              >
                {p}
              </button>
            ),
        )}

        <PagBtn disabled={page === totalPages} onClick={() => onPageChange(page + 1)}>›</PagBtn>
      </div>
    </div>
  );
}

// ── 페이지당 항목 수 선택박스 (상단 오른쪽 배치용) ──────────────────
interface LimitSelectProps {
  limit: number;
  onLimitChange: (limit: number) => void;
}

export function LimitSelect({ limit, onLimitChange }: LimitSelectProps) {
  return (
    <select
      className="input w-auto min-w-[72px] text-[0.82rem] shrink-0"
      value={limit}
      aria-label="페이지당 항목 수"
      onChange={(e) => onLimitChange(Number(e.target.value))}
    >
      {LIMIT_OPTIONS.map((n) => (
        <option key={n} value={n}>{n}개</option>
      ))}
    </select>
  );
}

function PagBtn({ children, disabled, onClick }: { children: React.ReactNode; disabled: boolean; onClick: () => void }) {
  return (
    <button type="button" className={`${PAG_BASE} ${PAG_HOVER}`} disabled={disabled} onClick={onClick}>
      {children}
    </button>
  );
}

function buildPageRange(current: number, total: number): (number | '...')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  if (current <= 4) return [1, 2, 3, 4, 5, '...', total];
  if (current >= total - 3) return [1, '...', total - 4, total - 3, total - 2, total - 1, total];
  return [1, '...', current - 1, current, current + 1, '...', total];
}
