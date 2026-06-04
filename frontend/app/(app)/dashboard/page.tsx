'use client';

/**
 * 대시보드 페이지.
 * 이번 달 지출 현황·최근 활동·다가오는 일정·빠른 실행을 요약해 보여준다.
 * 스타일은 Tailwind 유틸 + 공통 컴포넌트(Card/Button/Badge/StatCard) 기반.
 */
import type { ReactNode } from 'react';
import AppShell from '@/components/AppShell';
import StatCard from '@/components/StatCard';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import { IconWon, IconLock, IconFolder, IconCube, IconUpload } from '@/components/icons';

// ── 더미 데이터 (TODO: API 연동 시 교체) ─────────────────────────

// 상단 요약 통계 — TODO: GET /api/v1/dashboard/summary
const STATS = [
  { tone: 'red'   as const, icon: <IconWon />,    value: '₩842K', label: '이번 달 지출', change: '▲ 12% 지난달 대비', changeDir: 'down' as const },
  { tone: 'green' as const, icon: <IconWon />,    value: '₩3.2M', label: '이번 달 수입', change: '= 고정 급여',        changeDir: 'neutral' as const, valueAccent: true },
  { tone: 'blue'  as const, icon: <IconLock />,   value: '60',    label: '저장된 계정', change: '+3 최근 추가',      changeDir: 'up' as const },
  { tone: 'amber' as const, icon: <IconFolder />, value: '51',    label: '보관 파일',   change: '24.5MB 사용',       changeDir: 'neutral' as const },
];

// 카테고리별 지출 — TODO: GET /api/v1/transactions/budget-by-category
const BUDGETS = [
  { label: '식비', amount: '₩312K / ₩400K', percent: 78, tone: 'warning' as const },
  { label: '교통', amount: '₩89K / ₩150K',  percent: 59, tone: 'green' as const },
  { label: '구독', amount: '₩187K / ₩200K', percent: 94, tone: 'danger' as const },
  { label: '쇼핑', amount: '₩154K / ₩300K', percent: 51, tone: 'green' as const },
  { label: '기타', amount: '₩100K / ₩150K', percent: 67, tone: 'green' as const },
];

// 최근 활동 — TODO: GET /api/v1/activities/recent
const ACTIVITIES = [
  { dot: 'green'   as const, text: <><strong>가계부 추가</strong> — 스타벅스 ₩6,500</>, time: '방금 전' },
  { dot: 'warning' as const, text: <><strong>구독 예산 90%</strong> 초과 경고</>,        time: '1시간 전' },
  { dot: 'muted'   as const, text: <><strong>파일 업로드</strong> — 보험증권_2025.pdf</>, time: '어제' },
  { dot: 'muted'   as const, text: <><strong>계정 추가</strong> — GitHub</>,             time: '2일 전' },
  { dot: 'muted'   as const, text: <><strong>AI 리포트</strong> 생성 완료 — 4월</>,       time: '3일 전' },
];

// 다가오는 일정 — TODO: GET /api/v1/calendar/upcoming
const UPCOMING = [
  { dot: 'warning' as const, text: <><strong>유튜브 프리미엄 결제</strong> — ₩14,900 · D-2</>, time: '6월 3일 · 구독' },
  { dot: 'warning' as const, text: <><strong>Disney+ 체험 종료</strong> — 자동결제 전환 주의</>, time: '6월 4일 · 구독' },
  { dot: 'green'   as const, text: <><strong>자동차 보험 갱신</strong></>,                     time: '6월 14일 · 할일' },
  { dot: 'muted'   as const, text: <><strong>여권 만료</strong> — 갱신 필요</>,                 time: '7월 29일 · 신원지갑' },
];

// 빠른 실행 — TODO: 각 href 라우트 구현 시 연결
const QUICK_ACTIONS = [
  { icon: <IconWon width={17} height={17} />,    title: '지출 기록',   desc: '가계부에 추가',     href: '#' },
  { icon: <IconLock width={17} height={17} />,   title: '계정 추가',   desc: 'ID/PW 저장',       href: '#' },
  { icon: <IconUpload width={17} height={17} />, title: '파일 업로드', desc: '문서/이미지 보관',  href: '#' },
  { icon: <IconCube width={17} height={17} />,   title: 'AI 리포트',   desc: '소비 패턴 분석',    href: '#' },
];

// 점/막대 색 매핑
const DOT_COLOR = { green: 'bg-accent', warning: 'bg-warning', muted: 'bg-muted' } as const;
const FILL_COLOR = { green: 'bg-accent', warning: 'bg-warning', danger: 'bg-danger' } as const;

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
  return (
    <AppShell activePath="/dashboard" topbarLabel="2025년 5월">
      {/* 페이지 헤더 */}
      <div className="mb-7 flex items-center justify-between gap-4">
        <div>
          <h1 className="[font-family:var(--font-display)] text-[1.55rem] font-bold tracking-[-0.03em] text-primary">안녕하세요, 김관리자님 👋</h1>
          <p className="text-sm text-secondary mt-1.5">이번 달 지출 현황과 최근 활동을 확인하세요.</p>
        </div>
      </div>

      {/* 상단 요약 통계 4칸 */}
      <div className="grid grid-cols-2 min-[1100px]:grid-cols-4 gap-4 mb-8">
        {STATS.map((s) => (
          <StatCard
            key={s.label}
            icon={s.icon}
            tone={s.tone}
            value={s.value}
            valueAccent={s.valueAccent}
            label={s.label}
            change={s.change}
            changeDir={s.changeDir}
          />
        ))}
      </div>

      {/* 카테고리별 지출 + 최근 활동 (2단) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
        <Card>
          <CardHeader>
            <CardTitle>카테고리별 지출</CardTitle>
            <Button href="#" variant="ghost" size="sm">전체 보기</Button>
          </CardHeader>
          <CardBody>
            {BUDGETS.map((b) => (
              <div className="flex flex-col gap-1.5 mb-[14px] last:mb-0" key={b.label}>
                <div className="flex justify-between text-[0.8rem]">
                  <span className="text-secondary font-medium">{b.label}</span>
                  <span className="text-muted">{b.amount}</span>
                </div>
                <div className="h-1.5 bg-elevated rounded-[3px] overflow-hidden">
                  <div className={`h-full rounded-[3px] transition-[width] duration-700 ${FILL_COLOR[b.tone]}`} style={{ width: `${b.percent}%` }} />
                </div>
              </div>
            ))}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>최근 활동</CardTitle>
            <Badge tone="success">{ACTIVITIES.length}건</Badge>
          </CardHeader>
          <CardBody compact>
            {ACTIVITIES.map((a, i) => <ActivityRow key={i} {...a} />)}
          </CardBody>
        </Card>
      </div>

      {/* 다가오는 일정 */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>📅 다가오는 일정</CardTitle>
          <Button href="#" variant="ghost" size="sm">캘린더 전체</Button>
        </CardHeader>
        <CardBody compact>
          {UPCOMING.map((u, i) => <ActivityRow key={i} {...u} />)}
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
