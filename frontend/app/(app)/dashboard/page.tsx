'use client';

import type { ReactNode } from 'react';
import { useApiQuery } from '@/lib/query';
import { qk } from '@/lib/queryKeys';
import AppShell from '@/components/AppShell';
import PageHeader from '@/components/PageHeader';
import QueryError from '@/components/QueryError';
import StatCard from '@/components/StatCard';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import { IconWon, IconLock, IconUpload, IconRepeat, IconPie } from '@/components/icons';
import { won, usd, signedWon, type TransactionType } from '@/lib/finance';

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
const DEADLINE_DOT: Record<DeadlineKind, 'green' | 'warning' | 'muted'> = { saving: 'muted', investment: 'muted', subscription: 'warning', task: 'green' };
const DEADLINE_LABEL: Record<DeadlineKind, string> = { saving: '예적금', investment: '투자', subscription: '구독', task: '할일' };

const EV_LABEL: Record<EvType, string> = { pay: '결제', due: '만기', exp: '만료', task: '할일' };
const TX_DOT: Record<TransactionType, 'green' | 'warning' | 'muted'> = { income: 'green', expense: 'muted', transfer: 'muted' };
const EV_DOT: Record<EvType, 'green' | 'warning' | 'muted'> = { pay: 'warning', exp: 'warning', task: 'green', due: 'muted' };
const DOT_COLOR = { green: 'bg-accent', warning: 'bg-warning', muted: 'bg-muted' } as const;
// 색상만으로 구분되던 상태 점에 스크린리더용 라벨 부여
const DOT_LABEL = { green: '정상', warning: '주의', muted: '정보' } as const;

const QUICK_ACTIONS = [
  { icon: <IconWon width={17} height={17} />,    title: '지출 기록',   desc: '가계부에 추가',     href: '/transactions' },
  { icon: <IconLock width={17} height={17} />,   title: '계정 추가',   desc: 'ID/PW 저장',       href: '/credentials' },
  { icon: <IconUpload width={17} height={17} />, title: '파일 업로드', desc: '문서/이미지 보관',  href: '/files' },
];

function ActivityRow({ dot, text, time }: { dot: 'green' | 'warning' | 'muted'; text: ReactNode; time: string }) {
  return (
    <div className="flex gap-3 py-2.5 border-b border-border-subtle last:border-b-0">
      <div role="img" aria-label={DOT_LABEL[dot]} className={`w-2 h-2 rounded-full shrink-0 mt-1.25 ${DOT_COLOR[dot]}`} />
      <div className="min-w-0 flex-1">
        <div className="text-[0.838rem] text-secondary leading-normal [&_strong]:text-primary [&_strong]:font-semibold truncate">{text}</div>
        <div className="text-[0.72rem] text-muted mt-0.5">{time}</div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  // 대시보드 데이터 (React Query 캐시 — 페이지 재진입 시 재조회 최소화)
  const summaryQuery = useApiQuery<Summary>(qk.dashboard.summary(), '/dashboard/summary');
  const forecastQuery = useApiQuery<Forecast>(qk.dashboard.forecast(), '/dashboard/cashflow-forecast');
  const deadlinesQuery = useApiQuery<Deadline[]>(qk.dashboard.deadlines(), '/dashboard/deadlines');

  const s = summaryQuery.data ?? null;
  const forecast = forecastQuery.data ?? null;
  const deadlines = deadlinesQuery.data ?? [];

  // 저장된 계정 수 카드
  const credQuery = useApiQuery<{ id: number }[]>(qk.credentials.list(), '/credentials');
  const credCount = credQuery.data ? credQuery.data.length : null;

  const stats = s
    ? [
        { tone: 'red' as const,   icon: <IconWon />,    value: won(s.stats.expense),      label: '이번 달 지출', change: '이번 달 합계', changeDir: 'down' as const },
        { tone: 'green' as const, icon: <IconWon />,    value: won(s.stats.income),        label: '이번 달 수입', change: '이번 달 합계', changeDir: 'up' as const, valueAccent: true },
        { tone: 'blue' as const,  icon: <IconPie />,    value: won(s.stats.netWorth),      label: '순자산',       change: '현금 + 예적금 + 투자', changeDir: 'neutral' as const },
        { tone: 'amber' as const, icon: <IconRepeat />, value: `${s.stats.activeSubs}건`,  label: '활성 구독',    change: s.stats.trialSubs ? `체험 ${s.stats.trialSubs}건 포함` : '결제 중', changeDir: 'neutral' as const },
      ]
    : [];

  return (
    <AppShell activePath="/dashboard" topbarLabel="대시보드">
      <PageHeader title="대시보드" description="이번 달 지출 현황과 최근 활동을 확인하세요." />

      {(summaryQuery.isError || forecastQuery.isError || deadlinesQuery.isError) && (
        <QueryError
          message="일부 대시보드 데이터를 불러오지 못했습니다."
          onRetry={() => { summaryQuery.refetch(); forecastQuery.refetch(); deadlinesQuery.refetch(); }}
          className="mb-6 border border-border rounded-panel bg-background"
        />
      )}

      {/* 현황 카드 — 항상 전체 너비 */}
      <div className="grid grid-cols-2 min-[1100px]:grid-cols-4 gap-4 mb-8">
        {stats.map((st) => (
          <StatCard key={st.label} icon={st.icon} tone={st.tone} value={st.value} valueAccent={st.valueAccent} label={st.label} change={st.change} changeDir={st.changeDir} />
        ))}
        {credCount !== null && (
          <StatCard icon={<IconLock />} tone="red" value={`${credCount}개`} label="저장된 계정" change="계정 보관함" changeDir="neutral" />
        )}
      </div>

      {/* PC: 메인(좌) + 사이드바(우) 2-컬럼 / 모바일: 단일 컬럼 */}
      <div className="grid min-[1100px]:grid-cols-[1fr_300px] gap-6 items-start">

        {/* ── 좌: 메인 피드 ── */}
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>최근 활동</CardTitle>
              <Badge tone="success">{s?.recent.length ?? 0}건</Badge>
            </CardHeader>
            <CardBody compact>
              {s && s.recent.length === 0 && <div className="py-2.5 text-muted text-[0.84rem]">최근 활동이 없습니다.</div>}
              {s?.recent.map((r, i) => (
                <ActivityRow key={i} dot={TX_DOT[r.type]} text={<><strong>{r.title}</strong> {signedWon(r.type, r.amount)}</>} time={r.date} />
              ))}
            </CardBody>
          </Card>

          {forecast && (forecast.subscriptions.count > 0 || forecast.recurring.count > 0) && (
            <Card>
              <CardHeader>
                <CardTitle>💸 다음 달 고정지출 예측</CardTitle>
                <Badge tone="warning">{won(forecast.totalMonthly)}</Badge>
              </CardHeader>
              <CardBody>
                <div className="flex gap-3 mb-3 flex-wrap">
                  <div className="flex-1 min-w-[120px] px-4 py-3 bg-surface border border-border rounded-ui">
                    <div className="text-[0.72rem] text-muted">구독 {forecast.subscriptions.count}건</div>
                    <div className="text-[0.95rem] font-bold text-primary mt-0.5">{won(forecast.subscriptions.monthly)}</div>
                  </div>
                  <div className="flex-1 min-w-[120px] px-4 py-3 bg-surface border border-border rounded-ui">
                    <div className="text-[0.72rem] text-muted">반복지출 {forecast.recurring.count}건</div>
                    <div className="text-[0.95rem] font-bold text-primary mt-0.5">{won(forecast.recurring.monthly)}</div>
                  </div>
                </div>
                {forecast.items.slice(0, 5).map((it, i) => (
                  <ActivityRow
                    key={i}
                    dot={it.kind === 'subscription' ? 'warning' : 'muted'}
                    text={<strong>{it.name}</strong>}
                    time={`${it.kind === 'subscription' ? '구독' : '반복'} · ${it.cycle === 'yearly' ? '연' : it.cycle === 'weekly' ? '주' : '월'} ${it.currency === 'USD' ? usd(it.amount) : won(it.amount)} → 월 ${won(it.monthly)}`}
                  />
                ))}
                <p className="text-[0.72rem] text-muted mt-2">연·주 단위 항목은 월 단위로 환산한 추정치입니다.</p>
              </CardBody>
            </Card>
          )}
        </div>

        {/* ── 우: 사이드바 ── */}
        <div className="flex flex-col gap-6">
          {deadlines.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>⏳ 다가오는 만료·마감</CardTitle>
                <Badge tone="warning">{deadlines.length}건</Badge>
              </CardHeader>
              <CardBody compact>
                {deadlines.slice(0, 8).map((d, i) => (
                  <ActivityRow
                    key={i}
                    dot={DEADLINE_DOT[d.kind]}
                    text={<><strong>{d.title}</strong> <span className="text-[0.72rem] text-muted">· {DEADLINE_LABEL[d.kind]}</span></>}
                    time={`${d.date} · ${d.dday === 0 ? 'D-day' : `D-${d.dday}`}`}
                  />
                ))}
              </CardBody>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>📅 다가오는 일정</CardTitle>
              <Button href="/calendar" variant="ghost" size="sm">전체</Button>
            </CardHeader>
            <CardBody compact>
              {s && s.upcoming.length === 0 && <div className="py-2.5 text-muted text-[0.84rem]">다가오는 일정이 없습니다.</div>}
              {s?.upcoming.map((u, i) => (
                <ActivityRow key={i} dot={EV_DOT[u.type]} text={<strong>{u.title}</strong>} time={`${u.date} · ${EV_LABEL[u.type]}`} />
              ))}
            </CardBody>
          </Card>
        </div>
      </div>

      {/* 빠른 실행 — 전체 너비, 맨 아래 */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>빠른 실행</CardTitle>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-2 min-[1100px]:grid-cols-4 gap-4">
            {QUICK_ACTIONS.map((q) => (
              <a
                key={q.title}
                href={q.href}
                className="flex flex-col items-center text-center gap-2 px-3 py-4 min-[1100px]:flex-row min-[1100px]:text-left min-[1100px]:gap-3 min-[1100px]:px-4 min-[1100px]:py-3.5 border border-border rounded-ui bg-background transition-all hover:border-accent hover:bg-accent-dim hover:shadow-card"
              >
                <div className="w-9 h-9 rounded-ui bg-surface border border-border flex items-center justify-center text-accent shrink-0">{q.icon}</div>
                <div>
                  <div className="text-[0.78rem] font-semibold text-primary">{q.title}</div>
                  <div className="text-[0.68rem] text-muted mt-px">{q.desc}</div>
                </div>
              </a>
            ))}
          </div>
        </CardBody>
      </Card>
    </AppShell>
  );
}
