'use client';

/**
 * 대시보드 페이지.
 * 이번 달 지출 현황·최근 활동·다가오는 일정·빠른 실행을 요약해 보여준다.
 * 데이터는 백엔드(/dashboard/summary)와 연동. 스타일은 Tailwind + 공통 컴포넌트.
 */
import { useEffect, useState, type ReactNode } from 'react';
import AppShell from '@/components/AppShell';
import StatCard from '@/components/StatCard';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import { IconWon, IconLock, IconCube, IconUpload, IconRepeat, IconPie } from '@/components/icons';
import { api } from '@/lib/api';
import { won, signedWon, CATEGORY_LABEL, type TransactionType } from '@/lib/finance';

type EvType = 'pay' | 'due' | 'exp' | 'task';
interface Summary {
  stats: { income: number; expense: number; netWorth: number; activeSubs: number };
  budgets: { category: string; spent: number; budget: number; percent: number }[];
  recent: { type: TransactionType; title: string; amount: number; date: string }[];
  upcoming: { type: EvType; title: string; date: string }[];
}

const EV_LABEL: Record<EvType, string> = { pay: '결제', due: '만기', exp: '만료', task: '할일' };
// 점 색 (ActivityRow dot: green/warning/muted)
const TX_DOT: Record<TransactionType, 'green' | 'warning' | 'muted'> = { income: 'green', expense: 'muted', transfer: 'muted' };
const EV_DOT: Record<EvType, 'green' | 'warning' | 'muted'> = { pay: 'warning', exp: 'warning', task: 'green', due: 'muted' };
const DOT_COLOR = { green: 'bg-accent', warning: 'bg-warning', muted: 'bg-muted' } as const;
const FILL_COLOR = { green: 'bg-accent', warning: 'bg-warning', danger: 'bg-danger' } as const;

// 예산 소진율 → 막대 톤
function budgetTone(pct: number): 'green' | 'warning' | 'danger' {
  if (pct >= 90) return 'danger';
  if (pct >= 75) return 'warning';
  return 'green';
}

// 빠른 실행
const QUICK_ACTIONS = [
  { icon: <IconWon width={17} height={17} />,    title: '지출 기록',   desc: '가계부에 추가',     href: '/transactions' },
  { icon: <IconLock width={17} height={17} />,   title: '계정 추가',   desc: 'ID/PW 저장',       href: '/credentials' },
  { icon: <IconUpload width={17} height={17} />, title: '파일 업로드', desc: '문서/이미지 보관',  href: '/files' },
  { icon: <IconCube width={17} height={17} />,   title: 'AI 리포트',   desc: '소비 패턴 분석',    href: '/ai-report' },
];

// 활동/일정 공통 행
function ActivityRow({ dot, text, time }: { dot: 'green' | 'warning' | 'muted'; text: ReactNode; time: string }) {
  return (
    <div className="flex gap-3 py-2.5 border-b border-border-subtle last:border-b-0">
      <div className={`w-2 h-2 rounded-full shrink-0 mt-[5px] ${DOT_COLOR[dot]}`} />
      <div>
        <div className="text-[0.838rem] text-secondary leading-normal [&_strong]:text-primary [&_strong]:font-semibold">{text}</div>
        <div className="text-[0.72rem] text-muted mt-0.5">{time}</div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [s, setS] = useState<Summary | null>(null);

  useEffect(() => {
    api.get<Summary>('/dashboard/summary').then(setS).catch(() => {});
  }, []);

  const stats = s
    ? [
        { tone: 'red' as const,   icon: <IconWon />,  value: won(s.stats.expense), label: '이번 달 지출', change: '이번 달 합계',  changeDir: 'down' as const },
        { tone: 'green' as const, icon: <IconWon />,  value: won(s.stats.income),  label: '이번 달 수입', change: '이번 달 합계',  changeDir: 'up' as const, valueAccent: true },
        { tone: 'blue' as const,  icon: <IconPie />,  value: won(s.stats.netWorth), label: '순자산',      change: '자산 − 부채',   changeDir: 'neutral' as const },
        { tone: 'amber' as const, icon: <IconRepeat />, value: `${s.stats.activeSubs}건`, label: '활성 구독',  change: '결제 중',      changeDir: 'neutral' as const },
      ]
    : [];

  return (
    <AppShell activePath="/dashboard" topbarLabel="대시보드">
      {/* 페이지 헤더 */}
      <div className="mb-7 flex items-center justify-between gap-4">
        <div>
          <h1 className="[font-family:var(--font-display)] text-[1.55rem] font-bold tracking-[-0.03em] text-primary">대시보드</h1>
          <p className="text-sm text-secondary mt-1.5">이번 달 지출 현황과 최근 활동을 확인하세요.</p>
        </div>
      </div>

      {/* 상단 요약 통계 4칸 */}
      <div className="grid grid-cols-2 min-[1100px]:grid-cols-4 gap-4 mb-8">
        {stats.map((st) => (
          <StatCard key={st.label} icon={st.icon} tone={st.tone} value={st.value} valueAccent={st.valueAccent} label={st.label} change={st.change} changeDir={st.changeDir} />
        ))}
      </div>

      {/* 카테고리별 지출 + 최근 활동 (2단) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
        <Card>
          <CardHeader>
            <CardTitle>카테고리별 지출</CardTitle>
            <Button href="/transactions" variant="ghost" size="sm">전체 보기</Button>
          </CardHeader>
          <CardBody>
            {s && s.budgets.length === 0 && <p className="text-[0.82rem] text-muted">설정에서 카테고리 예산을 지정하세요.</p>}
            {s?.budgets.map((b) => {
              const tone = budgetTone(b.percent);
              return (
                <div className="flex flex-col gap-1.5 mb-[14px] last:mb-0" key={b.category}>
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
      </div>

      {/* 다가오는 일정 */}
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

      {/* 빠른 실행 */}
      <Card>
        <CardHeader>
          <CardTitle>빠른 실행</CardTitle>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-2 min-[1100px]:grid-cols-4 gap-4">
            {QUICK_ACTIONS.map((q) => (
              <a className="flex items-center gap-3 px-4 py-3.5 border border-border rounded-[var(--radius)] bg-background transition-all hover:border-accent hover:bg-accent-dim hover:shadow-[var(--shadow-sm)]" key={q.title} href={q.href}>
                <div className="w-9 h-9 rounded-[var(--radius)] bg-surface border border-border flex items-center justify-center text-accent shrink-0">{q.icon}</div>
                <div>
                  <div className="text-[0.82rem] font-semibold text-primary">{q.title}</div>
                  <div className="text-[0.72rem] text-muted mt-px">{q.desc}</div>
                </div>
              </a>
            ))}
          </div>
        </CardBody>
      </Card>
    </AppShell>
  );
}
