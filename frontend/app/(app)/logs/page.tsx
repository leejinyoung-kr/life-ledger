'use client';

import { useState, useMemo, Fragment } from 'react';
import AppShell from '@/components/AppShell';
import PageHeader from '@/components/PageHeader';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Segmented from '@/components/ui/Segmented';
import SearchInput from '@/components/ui/SearchInput';
import Pagination, { LimitSelect } from '@/components/Pagination';
import ListToolbar from '@/components/ListToolbar';
import ErrorBanner from '@/components/ErrorBanner';
import EmptyState from '@/components/EmptyState';
import { IconCaret } from '@/components/icons';
import { useApiQuery } from '@/lib/query';
import { qk } from '@/lib/queryKeys';
import { usePagination } from '@/lib/usePagination';
import { localDate } from '@/lib/finance';
import FilterPanel from '@/components/FilterPanel';
import { Card } from '@/components/ui/Card';

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

const LEVEL_TONE = {
  info: 'neutral',
  warn: 'warning',
  error: 'danger',
} as const satisfies Record<LogLevel, 'neutral' | 'warning' | 'danger'>;

const LEVEL_LABEL: Record<LogLevel, string> = {
  info: '정보',
  warn: '경고',
  error: '오류',
};

// 로그 상세(metadata) 키 → 화면 이름. 목록에 없는 키는 그대로 보인다
const META_LABEL: Record<string, string> = {
  total: '대상 수',
  ok: '성공',
  failed: '실패',
  updated: '갱신',
  error: '오류',
  dbError: 'DB 오류',
  b2Error: 'B2 오류',
  runId: '실행 번호',
  month: '월',
  period: '회차',
  periods: '회차',
  investmentId: '투자 번호',
  symbol: '종목 코드',
  type: '종류',
  quantity: '수량',
  amountKrw: '원화 금액',
  required: '필요 금액',
  currency: '통화',
  usdAmount: '달러 금액',
  scheduleId: '자동이체 번호',
  transactionId: '거래 번호',
  title: '제목',
  amount: '금액',
  reason: '사유',
  objectKey: '파일 키',
  files: '파일 수',
  outboxId: '발송 번호',
  attempts: '시도 횟수',
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
    <AppShell activePath="/logs">
      <PageHeader title="시스템 로그" description="크론 실행, 반복매수, 오류 이력을 확인합니다." />

      {/* 레벨 알약 — 클릭 즉시 반영 (수준별 개수는 서버가 주지 않아 붙이지 않는다) */}
      <Segmented
        label="로그 레벨"
        className="pb-3"
        value={level}
        onChange={(l) => { setLevel(l); setPage(1); }}
        items={(['all', 'info', 'warn', 'error'] as const).map((l) => ({ value: l, label: l === 'all' ? '전체' : LEVEL_LABEL[l] }))}
      />

      {/* 필터 줄 — 조회 버튼으로 반영 */}
      <FilterPanel className="mb-0">
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
          <Segmented
            label="조회 기간"
            variant="joined"
            value={activePreset === null ? '' : String(activePreset)}
            onChange={(m) => handleApplyPreset(Number(m))}
            items={[1, 2, 3].map((m) => ({ value: String(m), label: `${m}개월` }))}
          />
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

      <ListToolbar total={total}>
        <LimitSelect limit={limit} onLimitChange={(l) => { changeLimit(l); }} />
      </ListToolbar>

      {/* 로그 목록 — 흰 카드 안 줄 목록, 행을 누르면 상세(metadata)가 펼쳐진다 */}
      <Card clip className="flex flex-col mt-3">
        {!logsQuery.isLoading && items.length === 0 && (
          <EmptyState size="lg" message="해당하는 로그가 없습니다." />
        )}
        {items.map((log) => {
          const isOpen = expanded.has(log.id);
          const full = formatLogTime(log.created_at);
          return (
            <div key={log.id} className={`flex flex-col border-b border-border-subtle last:border-b-0 ${log.level === 'error' ? 'bg-danger-dim shadow-[inset_2px_0_0_var(--color-danger)]' : ''}`}>
              <button
                type="button"
                className="flex items-center gap-2.5 px-4 py-2.5 max-md:flex-wrap max-md:gap-y-1.5 max-md:min-h-11 text-left cursor-pointer transition-colors hover:bg-hover"
                aria-expanded={isOpen}
                onClick={() => toggleExpand(log.id)}
              >
                <Badge tone={LEVEL_TONE[log.level]}>{LEVEL_LABEL[log.level]}</Badge>
                <span className="w-15 max-md:w-auto text-[0.78rem] text-muted">{CATEGORY_LABEL[log.category] ?? log.category}</span>
                {/* 휴대폰은 메시지를 둘째 줄 전체로 내리고, 첫 줄은 등급 · 구분 ··· 시각 */}
                <span className="flex-1 min-w-0 max-md:order-last max-md:basis-full text-[0.84rem] text-primary break-keep">{log.message}</span>
                <span className="max-md:ml-auto shrink-0 text-[0.78rem] text-muted tabular-nums whitespace-nowrap">{full}</span>
                <IconCaret className={`w-3.75 h-3.75 text-muted transition-transform shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* 상세(metadata) — 줄 왼쪽 끝에 맞춘 안쪽 상자. 앞을 비워 들여 쓰면 위 줄과 어긋나 보여서 상자로 묶는다 */}
              {isOpen && (
                <div className="grid grid-cols-[96px_1fr] gap-x-4 gap-y-1.5 mx-4 mb-3 px-4 py-3 rounded-ui border border-border-subtle bg-surface text-[0.78rem]">
                  <span className="text-muted">시각</span>
                  <span className="text-primary">{full}</span>
                  {log.metadata && Object.entries(log.metadata).map(([k, v]) => (
                    <Fragment key={k}>
                      <span className="text-muted">{META_LABEL[k] ?? k}</span>
                      <span className="text-primary break-all">{Array.isArray(v) ? v.join(', ') : String(v)}</span>
                    </Fragment>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </Card>
      <Pagination page={page} totalPages={totalPages} totalItems={total} onPageChange={setPage} />
    </AppShell>
  );
}
