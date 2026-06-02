'use client';

/**
 * 공통 페이지네이션 컴포넌트.
 * - Pagination: 하단 페이지 번호 내비게이션
 * - LimitSelect: 상단 오른쪽에 배치하는 "n개씩 보기" 선택박스
 */

const LIMIT_OPTIONS = [10, 20, 30];

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
    <div className="pagination">
      <div className="pagination-pages">
        <PagBtn disabled={page === 1} onClick={() => onPageChange(page - 1)}>‹</PagBtn>

        {pages.map((p, i) =>
          p === '...'
            ? <span key={`el-${i}`} className="pagination-ellipsis">…</span>
            : (
              <button
                key={p}
                type="button"
                className={`pagination-btn${page === p ? ' active' : ''}`}
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
      className="input limit-select"
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
    <button type="button" className="pagination-btn" disabled={disabled} onClick={onClick}>
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
