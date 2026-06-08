'use client';

import { useMemo, type ReactNode } from 'react';
import { useApiQuery } from '@/lib/query';
import { qk } from '@/lib/queryKeys';
import AppShell from '@/components/AppShell';
import StatCard from '@/components/StatCard';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import { IconWon, IconLock, IconCube, IconUpload, IconRepeat, IconPie } from '@/components/icons';
import { won, signedWon, CATEGORY_LABEL, type TransactionType } from '@/lib/finance';

type EvType = 'pay' | 'due' | 'exp' | 'task';
interface Summary {
  stats: { income: number; expense: number; netWorth: number; activeSubs: number };
  budgets: { category: string; spent: number; budget: number; percent: number }[];
  recent: { type: TransactionType; title: string; amount: number; date: string }[];
  upcoming: { type: EvType; title: string; date: string }[];
}

interface Forecast {
  totalMonthly: number;
  subscriptions: { count: number; monthly: number };
  recurring: { count: number; monthly: number };
  items: { name: string; kind: 'subscription' | 'recurring'; cycle: string; amount: number; monthly: number }[];
}

type DeadlineKind = 'identity' | 'saving' | 'subscription' | 'task';
interface Deadline { kind: DeadlineKind; title: string; date: string; dday: number }
const DEADLINE_DOT: Record<DeadlineKind, 'green' | 'warning' | 'muted'> = { identity: 'warning', saving: 'muted', subscription: 'warning', task: 'green' };
const DEADLINE_LABEL: Record<DeadlineKind, string> = { identity: '신원', saving: '예적금', subscription: '구독', task: '할일' };

const EV_LABEL: Record<EvType, string> = { pay: '결제', due: '만기', exp: '만료', task: '할일' };
const TX_DOT: Record<TransactionType, 'green' | 'warning' | 'muted'> = { income: 'green', expense: 'muted', transfer: 'muted' };
const EV_DOT: Record<EvType, 'green' | 'warning' | 'muted'> = { pay: 'warning', exp: 'warning', task: 'green', due: 'muted' };
const DOT_COLOR = { green: 'bg-accent', warning: 'bg-warning', muted: 'bg-muted' } as const;
const FILL_COLOR = { green: 'bg-accent', warning: 'bg-warning', danger: 'bg-danger' } as const;

function budgetTone(pct: number): 'green' | 'warning' | 'danger' {
  if (pct >= 90) return 'danger';
  if (pct >= 75) return 'warning';
  return 'green';
}

const QUICK_ACTIONS = [
  { icon: <IconWon width={17} height={17} />,    title: '지출 기록',   desc: '가계부에 추가',     href: '/transactions' },
  { icon: <IconLock width={17} height={17} />,   title: '계정 추가',   desc: 'ID/PW 저장',       href: '/credentials' },
  { icon: <IconUpload width={17} height={17} />, title: '파일 업로드', desc: '문서/이미지 보관',  href: '/files' },
  { icon: <IconCube width={17} height={17} />,   title: 'AI 리포트',   desc: '소비 패턴 분석',    href: '/ai-report' },
];

function ActivityRow({ dot, text, time }: { dot: 'green' | 'warning' | 'muted'; text: ReactNode; time: string }) {
  return (
    <div className="flex gap-3 py-2.5 border-b border-border-subtle last:border-b-0">
      <div className={`w-2 h-2 rounded-full shrink-0 mt-1.25 ${DOT_COLOR[dot]}`} />
      <div>
        <div className="text-[0.838rem] text-secondary leading-normal [&_strong]:text-primary [&_strong]:font-semibold">{text}</div>
        <div className="text-[0.72rem] text-muted mt-0.5">{time}</div>
      </div>
    </div>
  );
}

const DEFAULT_WIDGET_MAP: Record<string, boolean> = {
  'stat-cards': true, 'budget-bars': true,
  'recent-activity': true, 'quick-actions': true,
  'cred-count': false, 'ai-summary': false,
};

export default function DashboardPage() {
  // 대시보드 데이터 (React Query 캐시 — 페이지 재진입 시 재조회 최소화)
  const summaryQuery = useApiQuery<Summary>(qk.dashboard.summary(), '/dashboard/summary');
  const forecastQuery = useApiQuery<Forecast>(qk.dashboard.forecast(), '/dashboard/cashflow-forecast');
  const deadlinesQuery = useApiQuery<Deadline[]>(qk.dashboard.deadlines(), '/dashboard/deadlines');
  const settingsQuery = useApiQuery<{ widgets: { id: string; on: boolean }[] }>(qk.settings.detail(), '/settings');

  const s = summaryQuery.data ?? null;
  const forecast = forecastQuery.data ?? null;
  const deadlines = deadlinesQuery.data ?? [];

  // 위젯 표시여부 맵 + 순서 (설정에서 파생)
  const wMap = useMemo(() => {
    const map: Record<string, boolean> = { ...DEFAULT_WIDGET_MAP };
    settingsQuery.data?.widgets.forEach((w) => { map[w.id] = w.on; });
    return map;
  }, [settingsQuery.data]);
  const wOrder = useMemo(() => settingsQuery.data?.widgets.map((w) => w.id) ?? [], [settingsQuery.data]);

  // 저장된 계정 수 위젯 — 켜진 경우에만 조회
  const credCountOn = wMap['cred-count'];
  const credQuery = useApiQuery<{ id: number }[]>(qk.credentials.list(), '/credentials', { enabled: credCountOn });
  const credCount = credQuery.data ? credQuery.data.length : null;

  const stats = s
    ? [
        { tone: 'red' as const,   icon: <IconWon />,    value: won(s.stats.expense),      label: '이번 달 지출', change: '이번 달 합계', changeDir: 'down' as const },
        { tone: 'green' as const, icon: <IconWon />,    value: won(s.stats.income),        label: '이번 달 수입', change: '이번 달 합계', changeDir: 'up' as const, valueAccent: true },
        { tone: 'blue' as const,  icon: <IconPie />,    value: won(s.stats.netWorth),      label: '순자산',       change: '자산 − 부채',  changeDir: 'neutral' as const },
        { tone: 'amber' as const, icon: <IconRepeat />, value: `${s.stats.activeSubs}건`,  label: '활성 구독',    change: '결제 중',      changeDir: 'neutral' as const },
      ]
    : [];

  return (
    <AppShell activePath="/dashboard" topbarLabel="대시보드">
      <div className="mb-7 flex items-center justify-between gap-4">
        <div>
          <h1 className="[font-family:var(--font-display)] text-[1.55rem] font-bold tracking-[-0.03em] text-primary">대시보드</h1>
          <p className="text-sm text-secondary mt-1.5">이번 달 지출 현황과 최근 활동을 확인하세요.</p>
        </div>
      </div>

      {wMap['stat-cards'] && (
        <div className="grid grid-cols-2 min-[1100px]:grid-cols-4 gap-4 mb-8">
          {stats.map((st) => (
            <StatCard key={st.label} icon={st.icon} tone={st.tone} value={st.value} valueAccent={st.valueAccent} label={st.label} change={st.change} changeDir={st.changeDir} />
          ))}
          {wMap['cred-count'] && credCount !== null && (
            <StatCard icon={<IconLock />} tone="red" value={`${credCount}개`} label="저장된 계정" change="계정 보관함" changeDir="neutral" />
          )}
        </div>
      )}

      {(wMap['budget-bars'] || wMap['recent-activity']) && (() => {
        const budgetCard = (
          <Card key="budget-bars">
            <CardHeader>
              <CardTitle>카테고리별 지출</CardTitle>
              <Button href="/transactions" variant="ghost" size="sm">전체 보기</Button>
            </CardHeader>
            <CardBody>
              {s && s.budgets.length === 0 && <p className="text-[0.82rem] text-muted">설정에서 카테고리 예산을 지정하세요.</p>}
              {s?.budgets.map((b) => {
                const tone = budgetTone(b.percent);
                return (
                  <div className="flex flex-col gap-1.5 mb-3.5 last:mb-0" key={b.category}>
                    <div className="flex justify-between text-[0.8rem]">
                      <span className="text-secondary font-medium">{CATEGORY_LABEL[b.category] ?? b.category}</span>
                      <span className="text-muted">{won(b.spent)} / {won(b.budget)}</span>
                    </div>
                    <div className="h-1.5 bg-elevated rounded-[3px] overflow-hidden">
                      <div className={`h-full rounded-[3px] transition-[width] duration-700 ${FILL_COLOR[tone]}`} style={{ width: `${Math.min(b.percent, 100)}%` }} />
                    </div>
                  </div>
                );
              })}
            </CardBody>
          </Card>
        );
        const recentCard = (
          <Card key="recent-activity">
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
        );
        // 설정에서 지정한 위젯 순서대로 두 카드 정렬 (표시 토글된 것만)
        const cards = [
          { id: 'budget-bars', node: budgetCard, on: wMap['budget-bars'] },
          { id: 'recent-activity', node: recentCard, on: wMap['recent-activity'] },
        ]
          .filter((c) => c.on)
          .sort((a, b) => (wOrder.indexOf(a.id) - wOrder.indexOf(b.id)));
        return <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">{cards.map((c) => c.node)}</div>;
      })()}

      {wMap['ai-summary'] && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>🤖 AI 리포트 요약</CardTitle>
            <Button href="/ai-report" variant="ghost" size="sm">전체 보기</Button>
          </CardHeader>
          <CardBody>
            <p className="text-[0.82rem] text-muted">AI 리포트 페이지에서 소비 패턴 분석 및 인사이트를 확인하세요.</p>
          </CardBody>
        </Card>
      )}

      {/* 현금흐름 예측 — 구독 + 반복지출 월 환산 */}
      {forecast && (forecast.subscriptions.count > 0 || forecast.recurring.count > 0) && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>💸 다음 달 고정지출 예측</CardTitle>
            <Badge tone="warning">{won(forecast.totalMonthly)}</Badge>
          </CardHeader>
          <CardBody>
            <div className="flex gap-3 mb-3 flex-wrap">
              <div className="flex-1 min-w-[140px] px-4 py-3 bg-surface border border-border rounded-(--radius)">
                <div className="text-[0.72rem] text-muted">구독 {forecast.subscriptions.count}건</div>
                <div className="text-[0.95rem] font-bold text-primary mt-0.5">{won(forecast.subscriptions.monthly)}</div>
              </div>
              <div className="flex-1 min-w-[140px] px-4 py-3 bg-surface border border-border rounded-(--radius)">
                <div className="text-[0.72rem] text-muted">반복지출 {forecast.recurring.count}건</div>
                <div className="text-[0.95rem] font-bold text-primary mt-0.5">{won(forecast.recurring.monthly)}</div>
              </div>
            </div>
            {forecast.items.slice(0, 5).map((it, i) => (
              <ActivityRow
                key={i}
                dot={it.kind === 'subscription' ? 'warning' : 'muted'}
                text={<strong>{it.name}</strong>}
                time={`${it.kind === 'subscription' ? '구독' : '반복'} · ${it.cycle === 'yearly' ? '연' : it.cycle === 'weekly' ? '주' : '월'} ${won(it.amount)} → 월 ${won(it.monthly)}`}
              />
            ))}
            <p className="text-[0.72rem] text-muted mt-2">연·주 단위 항목은 월 단위로 환산한 추정치입니다.</p>
          </CardBody>
        </Card>
      )}

      {/* 통합 D-day 보드 — 만료·만기·결제·마감 한 화면 집계 */}
      {deadlines.length > 0 && (
        <Card className="mb-6">
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

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>📅 다가오는 일정</CardTitle>
          <Button href="/calendar" variant="ghost" size="sm">캘린더 전체</Button>
        </CardHeader>
        <CardBody compact>
          {s && s.upcoming.length === 0 && <div className="py-2.5 text-muted text-[0.84rem]">다가오는 일정이 없습니다.</div>}
          {s?.upcoming.map((u, i) => (
            <ActivityRow key={i} dot={EV_DOT[u.type]} text={<strong>{u.title}</strong>} time={`${u.date} · ${EV_LABEL[u.type]}`} />
          ))}
        </CardBody>
      </Card>

      {wMap['quick-actions'] && (
        <Card>
          <CardHeader>
            <CardTitle>빠른 실행</CardTitle>
          </CardHeader>
          <CardBody>
            <div className="grid grid-cols-2 min-[1100px]:grid-cols-4 gap-4">
              {QUICK_ACTIONS.map((q) => (
                <a className="flex items-center gap-3 px-4 py-3.5 border border-border rounded-(--radius) bg-background transition-all hover:border-accent hover:bg-accent-dim hover:shadow-(--shadow-sm)" key={q.title} href={q.href}>
                  <div className="w-9 h-9 rounded-(--radius) bg-surface border border-border flex items-center justify-center text-accent shrink-0">{q.icon}</div>
                  <div>
                    <div className="text-[0.82rem] font-semibold text-primary">{q.title}</div>
                    <div className="text-[0.72rem] text-muted mt-px">{q.desc}</div>
                  </div>
                </a>
              ))}
            </div>
          </CardBody>
        </Card>
      )}
    </AppShell>
  );
}
