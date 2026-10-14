'use client';

import AppShell from '@/components/AppShell';
import PageHeader from '@/components/PageHeader';
import ErrorBanner from '@/components/ErrorBanner';
import StatCard, { StatStrip } from '@/components/StatCard';
import BarChart from '@/components/BarChart';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card';
import { useApiQuery } from '@/lib/query';
import { qk } from '@/lib/queryKeys';
import { won } from '@/lib/finance';
import {
  ASSET_TYPE_LABEL, ASSET_TYPE_COLOR, BY_TYPE_CARD,
  wonM, millionsLabel,
  type NetWorthSummary, type TrendPoint, type AllocationItem,
} from '@/lib/networth';

// 도넛 conic-gradient 문자열 생성 (누적 percent 기준)
function buildDonutGradient(items: AllocationItem[]): string {
  let acc = 0;
  const stops = items.map((it) => {
    const color = ASSET_TYPE_COLOR[it.type];
    const seg = `${color} ${acc}% ${acc + it.percent}%`;
    acc += it.percent;
    return seg;
  });
  return `conic-gradient(${stops.join(', ')})`;
}

export default function NetworthPage() {
  // 순자산 데이터 (React Query 캐시)
  const summaryQuery = useApiQuery<NetWorthSummary>(qk.assets.networth(), '/assets/summary');
  const trendQuery = useApiQuery<TrendPoint[]>(['assets', 'trend'], '/assets/trend');
  const summary = summaryQuery.data ?? null;
  const trend = trendQuery.data ?? [];
  const error = (summaryQuery.error ?? trendQuery.error)?.message ?? null;

  const change = summary?.changeAmount ?? null;
  const up = (change ?? 0) >= 0;

  // 유형별 카드 — byType 항목에 카드 메타(아이콘/톤/라벨) 결합
  const cards = (summary?.byType ?? []).map((b) => {
    const meta = BY_TYPE_CARD[b.type];
    const change =
      b.type === 'cash' ? `입출금 ${b.count}건`
      : b.type === 'savings' ? (b.avgRate !== null ? `평균 ${b.avgRate}%` : `${b.count}건`)
      : b.type === 'investment' ? `${b.count}종목`
      : `${b.count}건`;
    return { ...b, ...meta, value: wonM(b.amount), change };
  });

  return (
    <AppShell activePath="/networth">
      <PageHeader title="자산 종합" description="현금·예적금·투자를 합산해 순자산을 추적합니다." />

      <ErrorBanner message={error} />

      {summary && (
        <>
          {/* 히어로 — 총 순자산 + 도넛 + 범례 */}
          <div className="flex flex-col items-center text-center md:flex-row md:items-center md:text-left gap-7 p-7 bg-[linear-gradient(135deg,var(--accent-dim),transparent)] border border-border rounded-panel mb-6">
            <div className="flex-1 min-w-[200px]">
              <div className="text-[0.8rem] text-secondary font-semibold uppercase tracking-[0.06em] mb-2">총 순자산</div>
              <div className="[font-family:var(--font-display)] text-[2.6rem] font-extrabold tracking-[-0.04em] text-primary leading-none">{won(summary.netWorth)}</div>
              {change !== null && (
                <div className={`mt-2.5 text-[0.875rem] font-semibold ${up ? 'text-success' : 'text-danger'}`}>
                  {up ? '▲' : '▼'} {won(Math.abs(change))} ({Math.abs(summary.changeRate ?? 0)}%) 지난달 말 대비
                </div>
              )}
            </div>
            <div className="flex items-center justify-center md:justify-start gap-7 flex-wrap">
              <div
                className="w-40 h-40 rounded-full shrink-0 flex items-center justify-center relative after:content-[''] after:w-24 after:h-24 after:rounded-full after:bg-background"
                style={{ background: buildDonutGradient(summary.allocation) }}
              >
                <div className="absolute text-center">
                  <div className="text-[0.7rem] text-muted">자산</div>
                  <div className="[font-family:var(--font-display)] font-bold text-base">{wonM(summary.totalAssets)}</div>
                </div>
              </div>
              <div className="flex flex-col items-center md:items-start gap-2">
                {summary.allocation.map((a) => (
                  <div className="flex items-center gap-2 text-[0.82rem]" key={a.type}>
                    <span className="w-2.5 h-2.5 rounded-[3px] shrink-0" style={{ background: ASSET_TYPE_COLOR[a.type] }} />
                    {ASSET_TYPE_LABEL[a.type]} {wonM(a.amount)} ({a.percent}%)
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 자산 유형별 통계 */}
          <StatStrip>
            {cards.map((c) => (
              <StatCard key={c.type} icon={c.icon} tone={c.tone} value={c.value} label={c.label} change={c.change} changeDir="neutral" />
            ))}
          </StatStrip>
        </>
      )}

      {/* 추이 막대 */}
      <div className="mb-6">
        <Card>
          <CardHeader><CardTitle>순자산 추이 (6개월)</CardTitle></CardHeader>
          <CardBody>
            <BarChart
              label="순자산 추이"
              items={trend.map((t) => ({ key: t.month, label: t.label, value: t.netWorth, valueLabel: millionsLabel(t.netWorth), current: t.current }))}
            />
          </CardBody>
        </Card>
      </div>

    </AppShell>
  );
}
