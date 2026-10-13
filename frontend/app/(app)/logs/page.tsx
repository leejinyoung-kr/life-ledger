'use client';

import { useState, useMemo } from 'react';
import AppShell from '@/components/AppShell';
import PageHeader from '@/components/PageHeader';
import Button from '@/components/ui/Button';
import Segmented from '@/components/ui/Segmented';
import SearchInput from '@/components/ui/SearchInput';
import Pagination, { LimitSelect } from '@/components/Pagination';
import ErrorBanner from '@/components/ErrorBanner';
import EmptyState from '@/components/EmptyState';
import { IconClock, IconCaret } from '@/components/icons';
import { useApiQuery } from '@/lib/query';
import { qk } from '@/lib/queryKeys';
import { usePagination } from '@/lib/usePagination';
import { localDate } from '@/lib/finance';
import FilterPanel from '@/components/FilterPanel';

type LogLevel = 'info' | 'warn' | 'error';
type LogCategory = 'recurring_buy' | 'recurring_tx' | 'cron' | 'asset' | 'file' | 'security' | 'notification';

interface SystemLog {
  id: number;
  user_id: number | null;
  level: LogLevel;
  category: LogCategory;
  message: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

const CATEGORY_LABEL: Record<LogCategory, string> = {
  recurring_buy: '반복매수',
  recurring_tx: '반복거래',
  cron: '크론',
  asset: '자산',
  file: '파일',
  security: '보안',
  notification: '알림',
};

const LEVEL_STYLE: Record<LogLevel, string> = {
  info: 'bg-blue-dim text-blue',
  warn: 'bg-warning-dim text-warning',
  error: 'bg-danger-dim text-danger',
};

const LEVEL_LABEL: Record<LogLevel, string> = {
  info: '정보',
  warn: '경고',
  error: '오류',
};

function monthsAgo(n: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return localDate(d);
}
function toDay(): string {
  return localDate();
}

function formatLogTime(iso: string): string {
  const d = new Date(iso);
  const ymd = `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
  const hms = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
  return `${ymd} ${hms}`;
}

interface Applied {
  from: string;
  to: string;
  category: LogCategory | '';
  q: string;
}

export default function LogsPage() {
  const [level, setLevel] = useState<LogLevel | 'all'>('all');
  const [pendingFrom, setPendingFrom] = useState(() => monthsAgo(1));
  const [pendingTo, setPendingTo] = useState(toDay);
  const [pendingCategory, setPendingCategory] = useState<LogCategory | ''>('');
  const [pendingQ, setPendingQ] = useState('');
  const [activePreset, setActivePreset] = useState<number | null>(1);
  const [applied, setApplied] = useState<Applied>(() => ({
    from: monthsAgo(1),
    to: toDay(),
    category: '',
    q: '',
  }));
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const { page, setPage, limit, changeLimit } = usePagination();

  function handleSearch() {
    setApplied({ from: pendingFrom, to: pendingTo, category: pendingCategory, q: pendingQ });
    setPage(1);
  }

  function handleReset() {
    const from = monthsAgo(1);
    const to = toDay();
    setPendingFrom(from);
    setPendingTo(to);
    setPendingCategory('');
    setPendingQ('');
    setActivePreset(1);
    setApplied({ from, to, category: '', q: '' });
    setPage(1);
  }

  function handleApplyPreset(months: number) {
    setPendingFrom(monthsAgo(months));
    setPendingTo(toDay());
    setActivePreset(months);
  }

  const queryParams = useMemo(() => {
    const p: Record<string, string> = {
      from: applied.from,
      to: applied.to,
      page: String(page),
      limit: String(limit),
    };
    if (level !== 'all') p.level = level;
    if (applied.category) p.category = applied.category;
    if (applied.q) p.q = applied.q;
    return p;
  }, [level, applied, page, limit]);

  const qs = useMemo(() => new URLSearchParams(queryParams).toString(), [queryParams]);

  const logsQuery = useApiQuery<{ items: SystemLog[]; total: number }>(
    qk.systemLogs.list(queryParams),
    `/system-logs?${qs}`,
  );
  const items = logsQuery.data?.items ?? [];
  const total = logsQuery.data?.total ?? 0;
  const totalPages = Math.ceil(total / limit) || 1;

  function toggleExpand(id: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <AppShell activePath="/logs" topbarLabel="시스템 로그">
      <PageHeader
        title="시스템 로그"
        icon={<IconClock className="w-6 h-6 text-accent shrink-0" />}
        description="크론 실행, 반복매수, 오류 이력을 확인합니다."
      />

      {/* 레벨 탭 — 클릭 즉시 반영 */}
      <Segmented
        label="로그 레벨"
        size="xs"
        className="mb-3"
        value={level}
        onChange={(l) => { setLevel(l); setPage(1); }}
        items={(['all', 'info', 'warn', 'error'] as const).map((l) => ({ value: l, label: l === 'all' ? '전체' : LEVEL_LABEL[l] }))}
      />

      {/* 필터박스 — 조회 버튼으로 반영 */}
      <FilterPanel>
        {/* 1행: 날짜 범위 + 기간 프리셋 */}
        <div className="flex gap-2 items-center flex-wrap">
          <div className="date-range-group flex items-center gap-2 shrink-0">
            <input
              type="date"
              className="input date-range-input w-35"
              value={pendingFrom}
              onChange={(e) => { setPendingFrom(e.target.value); setActivePreset(null); }}
              aria-label="조회 시작일"
            />
            <span className="text-muted text-[0.82rem] shrink-0 px-1">~</span>
            <input
              type="date"
              className="input date-range-input w-35"
              value={pendingTo}
              onChange={(e) => { setPendingTo(e.target.value); setActivePreset(null); }}
              aria-label="조회 종료일"
            />
          </div>
          <div className="flex gap-1">
            <Button size="sm" variant={activePreset === 1 ? 'primary' : 'ghost'} onClick={() => handleApplyPreset(1)}>1개월</Button>
            <Button size="sm" variant={activePreset === 2 ? 'primary' : 'ghost'} onClick={() => handleApplyPreset(2)}>2개월</Button>
            <Button size="sm" variant={activePreset === 3 ? 'primary' : 'ghost'} onClick={() => handleApplyPreset(3)}>3개월</Button>
          </div>
        </div>
        {/* 2행: 카테고리 + 메시지 검색 + 조회/초기화 */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:flex-wrap">
          <select
            className="input w-full sm:w-auto sm:min-w-30 shrink-0 text-[0.875rem]"
            value={pendingCategory}
            onChange={(e) => setPendingCategory(e.target.value as LogCategory | '')}
            aria-label="카테고리 필터"
          >
            <option value="">전체 카테고리</option>
            {(Object.keys(CATEGORY_LABEL) as LogCategory[]).map((c) => (
              <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>
            ))}
          </select>
          <div className="flex gap-2 flex-1">
            <SearchInput label="메시지 검색" className="flex-1 min-w-0" placeholder="메시지 검색..." value={pendingQ} onChange={(e) => setPendingQ(e.target.value)} onEnter={handleSearch} />
            <Button onClick={handleSearch}>조회</Button>
          </div>
          <Button variant="ghost" className="w-full sm:w-auto" onClick={handleReset}>초기화</Button>
        </div>
      </FilterPanel>

      <ErrorBanner message={logsQuery.error?.message ?? null} />

      <div className="flex items-center justify-between mb-2">
        <span className="text-[0.78rem] text-secondary">총 {total}건</span>
        <LimitSelect limit={limit} onLimitChange={(l) => { changeLimit(l); }} />
      </div>

      {/* 로그 목록 */}
      <div className="bg-background border border-border rounded-lg shadow-card overflow-hidden mb-4">
        {!logsQuery.isLoading && items.length === 0 && (
          <EmptyState size="lg" message="해당하는 로그가 없습니다." />
        )}
        {items.map((log) => {
          const isOpen = expanded.has(log.id);
          const full = formatLogTime(log.created_at);
          return (
            <div key={log.id} className="border-b border-border last:border-b-0">
              <button
                type="button"
                className="w-full px-4 py-3.5 hover:bg-surface text-left transition-colors"
                onClick={() => toggleExpand(log.id)}
              >
                {/* PC 레이아웃 */}
                <div className="hidden sm:flex items-start gap-2.5">
                  <span className={`shrink-0 mt-px px-1.5 py-0.5 rounded text-[0.65rem] font-bold tracking-wider ${LEVEL_STYLE[log.level]}`}>
                    {LEVEL_LABEL[log.level]}
                  </span>
                  <span className="shrink-0 mt-px px-2 py-0.5 rounded bg-elevated text-muted text-[0.7rem] font-medium">
                    {CATEGORY_LABEL[log.category] ?? log.category}
                  </span>
                  <span className="flex-1 text-[0.875rem] text-primary min-w-0">{log.message}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[0.72rem] text-secondary dark:text-primary whitespace-nowrap font-mono">{full}</span>
                    <IconCaret className={`w-3.5 h-3.5 text-muted transition-transform shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
                  </div>
                </div>
                {/* 모바일 레이아웃 */}
                <div className="sm:hidden flex flex-col gap-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <span className={`px-1.5 py-0.5 rounded text-[0.65rem] font-bold tracking-wider ${LEVEL_STYLE[log.level]}`}>
                        {LEVEL_LABEL[log.level]}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-elevated text-muted text-[0.7rem] font-medium">
                        {CATEGORY_LABEL[log.category] ?? log.category}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[0.68rem] text-secondary dark:text-primary font-mono">{full}</span>
                      <IconCaret className={`w-3.5 h-3.5 text-muted transition-transform shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
                    </div>
                  </div>
                  <p className="text-[0.875rem] text-primary leading-snug">{log.message}</p>
                </div>
              </button>

              {/* 메타데이터 */}
              {isOpen && (
                <div className="px-4 pb-4 bg-surface">
                  <div className="border border-border rounded-ui p-3.5 flex flex-col gap-1.5 text-[0.8rem]">
                    <div className="flex gap-3 pb-1.5 mb-1 border-b border-border">
                      <span className="text-muted w-22 shrink-0">timestamp</span>
                      <span className="text-secondary dark:text-primary font-mono">{full}</span>
                    </div>
                    {log.metadata && Object.entries(log.metadata).map(([k, v]) => (
                      <div key={k} className="flex gap-3">
                        <span className="text-muted w-22 shrink-0">{k}</span>
                        <span className="text-primary break-all font-mono">{String(v)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
        <Pagination page={page} totalPages={totalPages} totalItems={total} onPageChange={setPage} />
      </div>
    </AppShell>
  );
}
