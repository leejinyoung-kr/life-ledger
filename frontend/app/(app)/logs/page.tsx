'use client';

import { useState, useMemo } from 'react';
import AppShell from '@/components/AppShell';
import Button from '@/components/ui/Button';
import Pagination, { LimitSelect } from '@/components/Pagination';
import { IconClock, IconCaret, IconSearch } from '@/components/icons';

type LogLevel = 'info' | 'warn' | 'error';
type LogCategory = 'recurring_buy' | 'recurring_tx' | 'cron' | 'asset' | 'file' | 'security' | 'ai';

interface SystemLog {
  id: number;
  level: LogLevel;
  category: LogCategory;
  message: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

const CATEGORY_LABEL: Record<LogCategory, string> = {
  recurring_buy: '반복매수',
  recurring_tx: '반복거래',
  cron: '크론',
  asset: '자산',
  file: '파일',
  security: '보안',
  ai: 'AI',
};

const LEVEL_STYLE: Record<LogLevel, string> = {
  info: 'bg-blue-dim text-blue',
  warn: 'bg-warning-dim text-warning',
  error: 'bg-danger-dim text-danger',
};

const LEVEL_LABEL: Record<LogLevel, string> = {
  info: 'INFO',
  warn: 'WARN',
  error: 'ERROR',
};

const DUMMY_LOGS: SystemLog[] = [
  {
    id: 16,
    level: 'warn',
    category: 'security',
    message: 'HIBP API 실패 — prefix: a3f2b, 해당 구간 미검출로 처리',
    metadata: { prefix: 'a3f2b', error: 'Connection timeout after 5000ms', action: 'skipped_check' },
    createdAt: '2026-07-04T09:15:22',
  },
  {
    id: 15,
    level: 'error',
    category: 'file',
    message: 'DB 저장 실패 후 B2 보상삭제도 실패 — key: uploads/2026/07/report_abc123.pdf',
    metadata: { objectKey: 'uploads/2026/07/report_abc123.pdf', dbError: 'Unique constraint failed', b2Error: 'Backblaze B2 API: 503 Service Unavailable' },
    createdAt: '2026-07-04T09:12:05',
  },
  {
    id: 14,
    level: 'warn',
    category: 'ai',
    message: 'AI 토큰 사용량 기록 실패',
    metadata: { error: 'insert into ai_usage_log: Connection refused', model: 'claude-sonnet-4-6', inputTokens: 1240, outputTokens: 380 },
    createdAt: '2026-07-04T09:10:18',
  },
  {
    id: 13,
    level: 'warn',
    category: 'asset',
    message: '달러 환율 조회 실패 — 달러 자산을 0원으로 처리. 순자산 수치 부정확 가능성',
    metadata: { error: 'Frankfurter API: HTTP 429 Too Many Requests', affectedUsdAmount: 2500 },
    createdAt: '2026-07-04T09:05:33',
  },
  {
    id: 12,
    level: 'info',
    category: 'recurring_tx',
    message: '반복거래 회차 생성 완료 — 월세 2026-07 회차',
    metadata: { title: '월세', period: '2026-07', amount: 500000, type: 'expense' },
    createdAt: '2026-07-04T09:00:44',
  },
  {
    id: 11,
    level: 'warn',
    category: 'recurring_buy',
    message: '카카오(035720) 2026-07 회차 예수금 부족 — 다음 크론에 재시도',
    metadata: { name: '카카오', symbol: '035720', period: '2026-07', required: 50000, cashBalance: 12000 },
    createdAt: '2026-07-04T09:00:38',
  },
  {
    id: 10,
    level: 'info',
    category: 'recurring_buy',
    message: 'AAPL(Apple Inc.) 2026-07 회차 매수 완료',
    metadata: { name: 'Apple Inc.', symbol: 'AAPL', period: '2026-07', priceUsd: 195.4, currency: 'USD', quantity: 0.5117, amountKrw: 100000 },
    createdAt: '2026-07-04T09:00:31',
  },
  {
    id: 9,
    level: 'info',
    category: 'recurring_buy',
    message: '삼성전자(005930) 2026-07 회차 매수 완료',
    metadata: { name: '삼성전자', symbol: '005930', period: '2026-07', priceKrw: 78300, quantity: 1.2758, amountKrw: 100000 },
    createdAt: '2026-07-04T09:00:22',
  },
  {
    id: 8,
    level: 'info',
    category: 'cron',
    message: '반복거래/반복매수 일괄 처리 완료 — 사용자 1명, 성공 3건 / 실패 1건',
    metadata: { users: 1, processed: 4, succeeded: 3, failed: 1 },
    createdAt: '2026-07-04T09:00:05',
  },
  {
    id: 7,
    level: 'warn',
    category: 'recurring_buy',
    message: '삼성전자(005930) 2026-06 시세조회 실패 — 다음 크론에 재시도',
    metadata: { name: '삼성전자', symbol: '005930', period: '2026-06', error: 'Naver Finance API: HTTP 500 Internal Server Error' },
    createdAt: '2026-07-03T09:01:14',
  },
  {
    id: 6,
    level: 'info',
    category: 'cron',
    message: 'DB 백업 완료 — backup-2026-07-03.sql.gz (12.3 MB)',
    metadata: { filename: 'backup-2026-07-03.sql.gz', sizeMb: 12.3, destination: '/backups/' },
    createdAt: '2026-07-03T04:00:12',
  },
  {
    id: 5,
    level: 'info',
    category: 'recurring_buy',
    message: 'AAPL(Apple Inc.) 2026-06 회차 매수 완료',
    metadata: { name: 'Apple Inc.', symbol: 'AAPL', period: '2026-06', priceUsd: 189.2, currency: 'USD', quantity: 0.5286, amountKrw: 100000 },
    createdAt: '2026-07-03T09:00:25',
  },
  {
    id: 4,
    level: 'info',
    category: 'recurring_buy',
    message: '삼성전자(005930) 2026-06 회차 매수 완료',
    metadata: { name: '삼성전자', symbol: '005930', period: '2026-06', priceKrw: 76800, quantity: 1.3021, amountKrw: 100000 },
    createdAt: '2026-07-03T09:00:18',
  },
  {
    id: 3,
    level: 'info',
    category: 'recurring_tx',
    message: '반복거래 회차 생성 완료 — 월세 2026-06 회차',
    metadata: { title: '월세', period: '2026-06', amount: 500000, type: 'expense' },
    createdAt: '2026-07-03T09:00:05',
  },
  {
    id: 2,
    level: 'error',
    category: 'security',
    message: '로그인 5회 연속 실패 — 계정 잠금 처리',
    metadata: { email: 'swlsdud100559@gmail.com', attempts: 5, lockUntil: '2026-07-02T16:15:00', ip: '192.168.1.101' },
    createdAt: '2026-07-02T16:00:33',
  },
  {
    id: 1,
    level: 'info',
    category: 'cron',
    message: 'DB 백업 완료 — backup-2026-07-02.sql.gz (12.1 MB)',
    metadata: { filename: 'backup-2026-07-02.sql.gz', sizeMb: 12.1, destination: '/backups/' },
    createdAt: '2026-07-02T04:00:09',
  },
];

function monthsAgo(n: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return d.toISOString().slice(0, 10);
}
function toDay(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatLogTime(iso: string): { full: string } {
  const d = new Date(iso);
  const ymd = `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
  const hms = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
  return { full: `${ymd} ${hms}` };
}

interface Applied {
  from: string;
  to: string;
  category: LogCategory | '';
  q: string;
}

export default function LogsPage() {
  // level: 즉시 반영 (조회 불필요)
  const [level, setLevel] = useState<LogLevel | 'all'>('all');
  // pending: 폼 입력값 (조회 버튼으로 반영)
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
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

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

  const filtered = useMemo(() => {
    return DUMMY_LOGS.filter((log) => {
      if (level !== 'all' && log.level !== level) return false;
      if (applied.category && log.category !== applied.category) return false;
      if (applied.q && !log.message.toLowerCase().includes(applied.q.toLowerCase())) return false;
      if (applied.from && log.createdAt < applied.from) return false;
      if (applied.to && log.createdAt > `${applied.to}T23:59:59`) return false;
      return true;
    });
  }, [level, applied]);

  const totalPages = Math.ceil(filtered.length / limit) || 1;
  const paged = filtered.slice((page - 1) * limit, page * limit);

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
      <div className="mb-7">
        <h1 className="[font-family:var(--font-display)] text-[1.55rem] font-bold tracking-[-0.03em] text-primary flex items-center gap-2.5">
          <IconClock className="w-6 h-6 text-accent shrink-0" />
          시스템 로그
        </h1>
        <p className="text-sm text-secondary mt-1.5">크론 실행, 반복매수, 오류 이력을 확인합니다.</p>
      </div>

      {/* 레벨 탭 — 클릭 즉시 반영 */}
      <div className="flex gap-1.5 mb-3">
        {(['all', 'info', 'warn', 'error'] as const).map((l) => (
          <Button
            key={l}
            size="sm"
            variant={level === l ? 'primary' : 'ghost'}
            onClick={() => { setLevel(l); setPage(1); }}
          >
            {l === 'all' ? '전체' : LEVEL_LABEL[l as LogLevel]}
          </Button>
        ))}
      </div>

      {/* 필터박스 — 조회 버튼으로 반영 */}
      <div className="bg-surface border border-border rounded-lg px-5 py-4 flex flex-col gap-3 mb-4">
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
          {/* 검색 + 조회: 항상 한 줄 유지 */}
          <div className="flex gap-2 flex-1">
            <div className="relative flex-1 min-w-0">
              <IconSearch className="absolute left-2.75 top-1/2 -translate-y-1/2 text-muted w-3.75 h-3.75 pointer-events-none" />
              <input
                className="input pl-icon w-full"
                type="text"
                placeholder="메시지 검색..."
                value={pendingQ}
                onChange={(e) => setPendingQ(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                aria-label="메시지 검색"
              />
            </div>
            <Button onClick={handleSearch}>조회</Button>
          </div>
          <Button variant="ghost" className="w-full sm:w-auto" onClick={handleReset}>초기화</Button>
        </div>
      </div>

      <div className="flex items-center justify-between mb-2">
        <span className="text-[0.78rem] text-secondary">총 {filtered.length}건</span>
        <LimitSelect limit={limit} onLimitChange={(l) => { setLimit(l); setPage(1); }} />
      </div>

      {/* 로그 목록 */}
      <div className="bg-background border border-border rounded-lg shadow-(--shadow-sm) overflow-hidden mb-4">
        {paged.length === 0 && (
          <div className="text-center text-muted py-12 text-sm">해당하는 로그가 없습니다.</div>
        )}
        {paged.map((log) => {
          const isOpen = expanded.has(log.id);
          const { full } = formatLogTime(log.createdAt);
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
                    {CATEGORY_LABEL[log.category]}
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
                        {CATEGORY_LABEL[log.category]}
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
                  <div className="border border-border rounded-(--radius) p-3.5 flex flex-col gap-1.5 text-[0.8rem]">
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
        <Pagination page={page} totalPages={totalPages} totalItems={filtered.length} onPageChange={setPage} />
      </div>
    </AppShell>
  );
}
