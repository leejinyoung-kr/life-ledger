'use client';

/**
 * 공통 페이지네이션 컴포넌트 (Tailwind).
 * - Pagination: 하단 페이지 번호 내비게이션 — 둥근 네모 칸, 지금 쪽은 진한 초록으로 채운다
 * - LimitSelect: 상단 오른쪽에 배치하는 "n개씩 보기" 선택박스
 */

import { ChevronLeft, ChevronRight } from 'lucide-react';

const LIMIT_OPTIONS = [10, 20, 30];

const PAG_BASE = 'min-w-8 h-8 px-2 rounded-ui text-[0.8125rem] tabular-nums inline-flex items-center justify-center transition-colors';
// 지금 쪽(초록) / 다른 쪽(올리면 회색) / 이전 · 다음(테두리 칸, 끝이면 흐리게)
const PAG_ON = 'bg-accent-dark text-on-solid font-semibold';
const PAG_OFF = 'text-secondary cursor-pointer hover:bg-hover hover:text-primary';
const PAG_STEP = 'w-8 px-0 border border-border bg-background text-secondary cursor-pointer enabled:hover:border-border-hover enabled:hover:bg-hover enabled:hover:text-primary disabled:opacity-40 disabled:cursor-not-allowed';

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
    <nav aria-label="쪽 이동" className="flex items-center justify-center gap-1 pt-4 pb-1">
      <PagStep label="이전 쪽" disabled={page === 1} onClick={() => onPageChange(page - 1)}><ChevronLeft size={16} /></PagStep>

      <div className="flex items-center gap-1 mx-1">
        {pages.map((p, i) =>
          p === '...'
            ? <span key={`el-${i}`} className="min-w-6 text-center text-muted text-[0.85rem]" aria-hidden>…</span>
            : (
              <button
                key={p}
                type="button"
                aria-current={page === p ? 'page' : undefined}
                className={`${PAG_BASE} ${page === p ? PAG_ON : PAG_OFF}`}
                onClick={() => onPageChange(Number(p))}
              >
                {p}
              </button>
            ),
        )}
      </div>

      <PagStep label="다음 쪽" disabled={page === totalPages} onClick={() => onPageChange(page + 1)}><ChevronRight size={16} /></PagStep>
    </nav>
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

// 이전 · 다음 칸 — 테두리 있는 네모 아이콘 버튼
function PagStep({ children, label, disabled, onClick }: { children: React.ReactNode; label: string; disabled: boolean; onClick: () => void }) {
  return (
    <button type="button" aria-label={label} className={`${PAG_BASE} ${PAG_STEP}`} disabled={disabled} onClick={onClick}>
      {children}
    </button>
  );
}

// 지금 쪽 기준으로 보일 번호 목록 — 7쪽 넘으면 양 끝 + 주변만 남기고 … 로 줄인다
function buildPageRange(current: number, total: number): (number | '...')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  if (current <= 4) return [1, 2, 3, 4, 5, '...', total];
  if (current >= total - 3) return [1, '...', total - 4, total - 3, total - 2, total - 1, total];
  return [1, '...', current - 1, current, current + 1, '...', total];
}
