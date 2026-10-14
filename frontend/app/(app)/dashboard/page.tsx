'use client';

import { useMemo, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useApiQuery, type Paginated } from '@/lib/query';
import { qk } from '@/lib/queryKeys';
import AppShell from '@/components/AppShell';
import PageHeader from '@/components/PageHeader';
import QueryError from '@/components/QueryError';
import BarChart from '@/components/BarChart';
import StatCard, { StatStrip } from '@/components/StatCard';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import MoreMenu from '@/components/ui/MoreMenu';
import { IconPlus, IconKey, IconUpload, IconRepeat, IconPie, IconArrowUp, IconArrowDown } from '@/components/icons';
import { won, usd, currentMonth, daysUntil, WEEKDAY_LABEL, type TransactionType, type TrendBucket } from '@/lib/finance';
import type { NetWorthSummary } from '@/lib/networth';
import type { SubscriptionSummary } from '@/lib/subscription';

type EvType = 'pay' | 'due' | 'exp' | 'task';
interface Summary {
  stats: { income: number; expense: number; netWorth: number; activeSubs: number; trialSubs: number };
  recent: { type: TransactionType; title: string; amount: number; date: string }[];
  upcoming: { type: EvType; title: string; date: string }[];
}

interface Forecast {
  totalMonthly: number;
  subscriptions: { count: number; monthly: number };
  recurring: { count: number; monthly: number };
  items: { name: string; kind: 'subscription' | 'recurring'; cycle: string; amount: number; currency: 'KRW' | 'USD'; monthly: number }[];
}

type DeadlineKind = 'saving' | 'investment' | 'subscription' | 'task';
interface Deadline { kind: DeadlineKind; title: string; date: string; dday: number }
const DEADLINE_MARKER: Record<DeadlineKind, EvType> = { saving: 'due', investment: 'due', subscription: 'pay', task: 'task' };
const DEADLINE_LABEL: Record<DeadlineKind, string> = { saving: '예적금', investment: '투자', subscription: '구독', task: '할일' };
const EV_LABEL: Record<EvType, string> = { pay: '결제', due: '만기', exp: '만료', task: '할일' };

// 종류별 표식 모양 — 색만으로 구분하지 않도록 모양(원 · 네모 · 마름모 · 빈 원)을 다르게 한다
const MARKER_CLASS: Record<EvType, string> = {
  pay: 'w-2 h-2 rounded-full bg-danger',
  due: 'w-2 h-2 border-[1.5px] border-blue',
  exp: 'w-[7px] h-[7px] border-[1.5px] border-warning rotate-45',
  task: 'w-2 h-2 rounded-full border-[1.5px] border-primary',
};

// 금액 한 줄 — 돈 색 + 부호 (수입 + · 지출 − · 자산이동 ⇄)
const AMOUNT_TONE: Record<TransactionType, { cls: string; sign: string }> = {
  income: { cls: 'text-success', sign: '+' },
  expense: { cls: 'text-danger', sign: '−' },
  transfer: { cls: 'text-blue', sign: '⇄ ' },
};

// 본문 카드 네 개(월별 지출 · 고정지출 · 다가오는 날짜 · 최근 활동)의 높이 — 데스크톱에서 모두 같게, 넘치는 목록은 카드 안에서 스크롤.
// 휴대폰은 한 줄에 하나라 내용 높이대로 두고, 차트만 높이를 준다
const PANEL = 'md:h-[480px] min-w-0 flex flex-col';
const PANEL_SCROLL = 'flex-1 min-h-0 md:overflow-y-auto';

interface UpcomingItem { key: string; date: string; title: string; marker: EvType; kind: string; dday: number }

// 표식 + 이름 + 보조 글자 + 오른쪽 값이 있는 목록 행 (누르는 곳 44px)
function ListRow({ lead, name, sub, trailing }: { lead?: ReactNode; name: ReactNode; sub: ReactNode; trailing?: ReactNode }) {
  return (
    <div className="flex items-center gap-3 px-[18px] py-2 min-h-11 border-b border-border-subtle last:border-b-0">
      {lead}
      <div className="flex-1 min-w-0 flex flex-col leading-snug">
        <span className="text-[0.84rem] text-primary truncate">{name}</span>
        <span className="text-[0.72rem] text-muted truncate tabular-nums">{sub}</span>
      </div>
      {trailing}
    </div>
  );
}

// 다가오는 날짜 한 줄 — 날짜(두 줄) · 표식 · 이름/종류 · 남은 일수
function UpcomingRow({ it }: { it: UpcomingItem }) {
  const d = new Date(`${it.date}T00:00:00`);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  const weekday = WEEKDAY_LABEL[d.getDay()];
  return (
    <ListRow
      lead={
        <div className="w-16 shrink-0 flex flex-col leading-tight tabular-nums">
          <span className="text-[0.84rem] text-primary">{it.date.slice(5).replace('-', '.')}</span>
          <span className="text-[0.7rem] text-muted">{sameYear ? weekday : `${d.getFullYear()} · ${weekday}`}</span>
        </div>
      }
      name={
        <span className="flex items-center gap-3">
          <span role="img" aria-label={EV_LABEL[it.marker]} className={`shrink-0 ${MARKER_CLASS[it.marker]}`} />
          <span className="truncate">{it.title}</span>
        </span>
      }
      sub={<span className="pl-5">{it.kind}</span>}
      trailing={
        <span className={`w-12 shrink-0 text-right text-[0.78rem] tabular-nums ${it.dday <= 3 ? 'text-warning' : 'text-muted'}`}>
          {it.dday === 0 ? 'D-day' : `D-${it.dday}`}
        </span>
      }
    />
  );
}

export default function DashboardPage() {
  const router = useRouter();
  // 대시보드 데이터 (React Query 캐시 — 페이지 재진입 시 재조회 최소화)
  const summaryQuery = useApiQuery<Summary>(qk.dashboard.summary(), '/dashboard/summary');
  const forecastQuery = useApiQuery<Forecast>(qk.dashboard.forecast(), '/dashboard/cashflow-forecast');
  const deadlinesQuery = useApiQuery<Deadline[]>(qk.dashboard.deadlines(), '/dashboard/deadlines');

  // 숫자 카드 아래 문구용 — 계정(2FA 미설정) · 구독(다음 결제) · 자산(지난달 대비)
  const month = currentMonth();
  const credQuery = useApiQuery<Paginated<{ id: number }> & { no2fa: number }>(qk.credentials.list({ dashboard: true }), '/credentials?page=1&limit=1');
  const subSummaryQuery = useApiQuery<SubscriptionSummary>(['subscriptions', 'summary'], '/subscriptions/summary');
  const networthQuery = useApiQuery<NetWorthSummary>(qk.assets.networth(), '/assets/summary');
  const trendQuery = useApiQuery<TrendBucket[]>(qk.transactions.monthlyTrend(month), `/transactions/monthly-trend?month=${month}`);

  const s = summaryQuery.data ?? null;
  const forecast = forecastQuery.data ?? null;
  const trend = trendQuery.data ?? [];
  const credTotal = credQuery.data?.total ?? null;
  const no2fa = credQuery.data?.no2fa ?? 0;
  const nextPayment = subSummaryQuery.data?.nextPayment ?? null;
  const networth = networthQuery.data ?? null;

  // 만료·마감(서버 계산)과 직접 일정을 날짜순으로 합친다 — 같은 날 같은 이름은 마감 쪽만 남긴다
  const upcoming = useMemo<UpcomingItem[]>(() => {
    const map = new Map<string, UpcomingItem>();
    for (const d of deadlinesQuery.data ?? []) {
      const marker = DEADLINE_MARKER[d.kind];
      map.set(`${marker}|${d.title}|${d.date}`, { key: `d-${d.kind}-${d.title}-${d.date}`, date: d.date, title: d.title, marker, kind: DEADLINE_LABEL[d.kind], dday: d.dday });
    }
    for (const u of summaryQuery.data?.upcoming ?? []) {
      const k = `${u.type}|${u.title}|${u.date}`;
      if (map.has(k)) continue;
      map.set(k, { key: `u-${k}`, date: u.date, title: u.title, marker: u.type, kind: EV_LABEL[u.type], dday: daysUntil(u.date) ?? 0 });
    }
    return [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
  }, [deadlinesQuery.data, summaryQuery.data]);
  const thisWeek = upcoming.filter((u) => u.dday <= 7);
  // 그 이후는 가까운 6건만 — 나머지는 캘린더에서 본다
  const later = upcoming.filter((u) => u.dday > 7).slice(0, 6);

  const now = new Date();
  const todayText = `${now.getFullYear()}년 ${now.getMonth() + 1}월 ${now.getDate()}일 ${WEEKDAY_LABEL[now.getDay()]}요일`;
  const periodText = `${now.getMonth() + 1}월 1일 – ${now.getDate()}일`;

  const subSub = [
    s && s.stats.trialSubs > 0 ? `체험 ${s.stats.trialSubs}건 포함` : null,
    nextPayment ? `다음 결제 ${nextPayment.name} · ${nextPayment.days <= 0 ? 'D-day' : `D-${nextPayment.days}`}` : null,
  ].filter(Boolean).join(' · ');

  const nwChange = networth?.changeRate ?? null;

  return (
    <AppShell activePath="/dashboard">
      <PageHeader
        title="대시보드"
        description={`${todayText} · 이번 달 돈 흐름과 곧 다가오는 날짜`}
        actions={
          <>
            <Button href="/transactions"><IconPlus />지출 기록</Button>
            <Button href="/credentials" variant="ghost" className="max-md:hidden"><IconKey />계정 추가</Button>
            <Button href="/files" variant="ghost" className="max-md:hidden"><IconUpload />파일 업로드</Button>
            <span className="md:hidden">
              <MoreMenu
                label="빠른 동작 더보기"
                size="lg"
                items={[
                  { label: '계정 추가', icon: <IconKey />, onSelect: () => router.push('/credentials') },
                  { label: '파일 업로드', icon: <IconUpload />, onSelect: () => router.push('/files') },
                ]}
              />
            </span>
          </>
        }
      />

      {(summaryQuery.isError || forecastQuery.isError || deadlinesQuery.isError) && (
        <QueryError
          message="일부 대시보드 데이터를 불러오지 못했습니다."
          onRetry={() => { summaryQuery.refetch(); forecastQuery.refetch(); deadlinesQuery.refetch(); }}
          className="mb-6 border border-border rounded-ui bg-background"
        />
      )}

      {/* 숫자 띠 — 카드를 누르면 해당 화면으로 */}
      <StatStrip>
        {s && (
          <>
            <StatCard href="/transactions" icon={<IconArrowUp />} tone="red" valueTone="out" value={won(s.stats.expense)} label="이번 달 지출" change={periodText} />
            <StatCard href="/transactions" icon={<IconArrowDown />} tone="green" valueTone="in" value={won(s.stats.income)} label="이번 달 수입" change={periodText} />
            <StatCard href="/networth"
                icon={<IconPie />}
                tone="blue"
                value={won(s.stats.netWorth)}
                label="순자산"
                change={nwChange !== null ? `${nwChange >= 0 ? '▲' : '▼'} ${Math.abs(nwChange)}% 지난달 대비` : '현금 + 예적금 + 투자'}
                changeDir={nwChange === null ? 'neutral' : nwChange >= 0 ? 'up' : 'down'}
              />
            <StatCard href="/subscriptions" icon={<IconRepeat />} tone="amber" value={`${s.stats.activeSubs}건`} label="활성 구독" change={subSub || '결제 중'} />
          </>
        )}
        {credTotal !== null && (
          <StatCard href="/credentials" icon={<IconKey />} tone="amber" value={`${credTotal}개`} label="저장된 계정" change={no2fa > 0 ? `2FA 미설정 ${no2fa}개` : '계정 보관함'} />
        )}
      </StatStrip>

      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap gap-6">
          <Card className={`flex-[2_1_520px] ${PANEL}`}>
            <CardHeader>
              <CardTitle>월별 지출</CardTitle>
              <Button href="/transactions" variant="link" size="inline">가계부</Button>
            </CardHeader>
            <CardBody className="flex-1 min-h-0 max-md:h-[280px]">
              <BarChart
                label="월별 지출"
                tone="out"
                height="fill"
                items={trend.map((b) => {
                  const isCurrent = b.month === month;
                  return { key: b.month, label: b.label, value: b.total, valueLabel: isCurrent ? won(b.total) : `${Math.round(b.total / 10000).toLocaleString('ko-KR')}만`, current: isCurrent };
                })}
              />
            </CardBody>
          </Card>

          {forecast && (forecast.subscriptions.count > 0 || forecast.recurring.count > 0) && (
            <Card className={`flex-[1_1_300px] ${PANEL}`}>
              <CardHeader>
                <CardTitle>다음 달 고정지출</CardTitle>
                <span className="text-[0.75rem] text-muted">예측</span>
              </CardHeader>
              <div className="px-[18px] pt-4 pb-1.5 flex flex-col gap-3">
                <span className="text-[1.75rem] leading-tight tracking-[-0.01em] text-danger tabular-nums">−{won(forecast.totalMonthly)}</span>
                <div className="grid grid-cols-2 border-y border-border-subtle">
                  <div className="py-2 flex flex-col">
                    <span className="text-[0.75rem] text-muted">구독 {forecast.subscriptions.count}건</span>
                    <span className="tabular-nums">{won(forecast.subscriptions.monthly)}</span>
                  </div>
                  <div className="py-2 pl-3.5 border-l border-border-subtle flex flex-col">
                    <span className="text-[0.75rem] text-muted">반복지출 {forecast.recurring.count}건</span>
                    <span className="tabular-nums">{won(forecast.recurring.monthly)}</span>
                  </div>
                </div>
              </div>
              <div className={`flex flex-col ${PANEL_SCROLL}`}>
                {forecast.items.map((it, i) => (
                  <ListRow
                    key={i}
                    name={it.name}
                    sub={`${it.kind === 'subscription' ? '구독' : '반복'} · ${it.cycle === 'yearly' ? '연' : it.cycle === 'weekly' ? '주' : '월'} ${it.currency === 'USD' ? usd(it.amount) : won(it.amount)}`}
                    trailing={<span className="text-[0.84rem] tabular-nums text-danger">−{won(it.monthly)}</span>}
                  />
                ))}
              </div>
              <p className="px-[18px] pt-2.5 pb-3.5 text-[0.72rem] text-muted">연·주 단위 항목은 월 단위로 환산한 추정치입니다.</p>
            </Card>
          )}
        </div>

        <div className="flex flex-wrap gap-6">
          <Card className={`flex-[2_1_520px] ${PANEL}`}>
            <CardHeader>
              <CardTitle>다가오는 날짜</CardTitle>
              <Button href="/calendar" variant="link" size="inline">{upcoming.length}건 · 캘린더</Button>
            </CardHeader>
            <div className={PANEL_SCROLL}>
              {upcoming.length === 0 && <div className="px-[18px] py-4 text-muted text-[0.84rem]">다가오는 날짜가 없습니다.</div>}
              {[{ label: '이번 주', items: thisWeek }, { label: '그 이후', items: later }].filter((g) => g.items.length > 0).map((g) => (
                <div key={g.label} className="flex flex-col">
                  <div className="px-[18px] pt-2.5 pb-1 text-[0.72rem] text-muted tracking-[0.06em]">{g.label}</div>
                  {g.items.map((it) => <UpcomingRow key={it.key} it={it} />)}
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-3.5 px-[18px] pt-2.5 pb-3.5 border-t border-border-subtle text-[0.72rem] text-muted">
              {(['pay', 'due', 'exp', 'task'] as const).map((t) => (
                <span key={t} className="flex items-center gap-1.5"><span aria-hidden className={MARKER_CLASS[t]} />{EV_LABEL[t]}</span>
              ))}
            </div>
          </Card>

          <Card className={`flex-[1_1_300px] ${PANEL}`}>
            <CardHeader>
              <CardTitle>최근 활동</CardTitle>
              <Button href="/transactions" variant="link" size="inline">가계부</Button>
            </CardHeader>
            <div className={PANEL_SCROLL}>
              {s && s.recent.length === 0 && <div className="px-[18px] py-4 text-muted text-[0.84rem]">최근 활동이 없습니다.</div>}
              {s?.recent.map((r, i) => {
                const tone = AMOUNT_TONE[r.type];
                return (
                  <ListRow
                    key={i}
                    name={r.title}
                    sub={r.date}
                    trailing={<span className={`text-[0.84rem] tabular-nums ${tone.cls}`}>{tone.sign}{won(Math.abs(r.amount))}</span>}
                  />
                );
              })}
            </div>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
