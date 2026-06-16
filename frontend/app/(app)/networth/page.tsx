'use client';

import AppShell from '@/components/AppShell';
import ErrorBanner from '@/components/ErrorBanner';
import StatCard from '@/components/StatCard';
import Badge from '@/components/ui/Badge';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card';
import { useApiQuery } from '@/lib/query';
import { qk } from '@/lib/queryKeys';
import { won } from '@/lib/finance';
import {
  ASSET_TYPE_LABEL, ASSET_TYPE_COLOR, BY_TYPE_CARD,
  wonM, millionsLabel,
  type Asset, type NetWorthSummary, type TrendPoint, type AllocationItem,
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
  const debtsQuery = useApiQuery<Asset[]>(['assets', 'debts'], '/assets?type=debt&take=5');
  const summary = summaryQuery.data ?? null;
  const trend = trendQuery.data ?? [];
  const debts = debtsQuery.data ?? [];
  const error = (summaryQuery.error ?? trendQuery.error ?? debtsQuery.error)?.message ?? null;

  const maxTrend = Math.max(1, ...trend.map((t) => t.netWorth));
  const up = (summary?.changeAmount ?? 0) >= 0;

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
    <AppShell activePath="/networth" topbarLabel="자산 종합">
      <div className="mb-7">
        <h1 className="[font-family:var(--font-display)] text-[1.55rem] font-bold tracking-[-0.03em] text-primary">자산 종합</h1>
        <p className="text-sm text-secondary mt-1.5">순자산 = 자산 − 부채. 현금·예적금·투자·부동산을 합산해 추적합니다.</p>
        <p className="text-[0.78rem] text-muted mt-1">자산·부채 항목은 자산 관리에서 추가·수정할 수 있습니다.</p>
      </div>

      <ErrorBanner message={error} />

      {summary && (
        <>
          {/* 히어로 — 총 순자산 + 도넛 + 범례 */}
          <div className="flex flex-col items-center text-center md:flex-row md:items-center md:text-left gap-7 p-7 bg-[linear-gradient(135deg,var(--accent-dim),transparent)] border border-border rounded-[var(--radius-lg)] mb-6">
            <div className="flex-1 min-w-[200px]">
              <div className="text-[0.8rem] text-secondary font-semibold uppercase tracking-[0.06em] mb-2">총 순자산</div>
              <div className="[font-family:var(--font-display)] text-[2.6rem] font-extrabold tracking-[-0.04em] text-primary leading-none">{won(summary.netWorth)}</div>
              <div className="mt-2.5 text-[0.875rem] text-accent font-semibold">
                {up ? '▲' : '▼'} {won(summary.changeAmount)} ({summary.changeRate}%) 지난달 대비
              </div>
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
          <div className="grid grid-cols-2 min-[1100px]:grid-cols-4 gap-4 mb-8">
            {cards.map((c) => (
              <StatCard key={c.type} icon={c.icon} tone={c.tone} value={c.value} label={c.label} change={c.change} changeDir="neutral" />
            ))}
          </div>
        </>
      )}

      {/* 추이 막대 + 부채 테이블 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
        <Card>
          <CardHeader><CardTitle>순자산 추이 (6개월)</CardTitle></CardHeader>
          <CardBody>
            <div className="bars">
              {trend.map((t) => (
                <div
                  key={t.month}
                  className={`bar${t.current ? ' current' : ''}`}
                  style={{ height: `${Math.round((t.netWorth / maxTrend) * 100)}%` }}
                >
                  <span>{millionsLabel(t.netWorth)}</span>
                  <small>{t.label}</small>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>부채</CardTitle>
            <Badge tone="danger">{summary ? wonM(summary.totalDebt) : '-'}</Badge>
          </CardHeader>
          <CardBody flush>
            <div className="table-wrap max-md:hidden">
              <table>
                <thead>
                  <tr>
                    <th>항목</th><th className="td-right">잔액</th><th className="td-right">금리</th>
                  </tr>
                </thead>
                <tbody>
                  {debts.length === 0 && (
                    <tr><td colSpan={3} className="td-center td-muted">부채가 없습니다.</td></tr>
                  )}
                  {debts.map((d) => (
                    <tr key={d.id}>
                      <td className="td-name">{d.name}</td>
                      <td className="td-mono td-right">{won(d.amount)}</td>
                      <td className="td-right">{d.interestRate !== null ? `${d.interestRate}%` : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="hidden max-md:flex flex-col gap-2.5 p-3">
              {debts.length === 0 && <div className="text-center text-muted py-7">부채가 없습니다.</div>}
              {debts.map((d) => (
                <div className="border border-border rounded-[var(--radius-lg)] p-3.5 bg-background" key={d.id}>
                  <div className="flex justify-between items-baseline gap-2.5">
                    <span className="font-semibold text-[0.95rem] break-all">{d.name}</span>
                    <span className="font-bold text-base whitespace-nowrap [font-family:var(--font-mono)]">{won(d.amount)}</span>
                  </div>
                  <div className="mt-2 text-[0.78rem] text-secondary">금리 {d.interestRate !== null ? `${d.interestRate}%` : '-'}</div>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      </div>

    </AppShell>
  );
}
