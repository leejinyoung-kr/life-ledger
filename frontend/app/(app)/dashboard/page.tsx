'use client';

/**
 * 대시보드 페이지.
 * 이번 달 지출 현황·최근 활동·다가오는 일정·빠른 실행을 요약해 보여준다.
 * 공통 레이아웃(AppShell)과 공통 카드(StatCard)를 재사용한다.
 */
import AppShell from '@/components/AppShell';
import StatCard from '@/components/StatCard';
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

export default function DashboardPage() {
  return (
    <AppShell activePath="/dashboard" topbarLabel="2025년 5월" actionLabel="지출 추가">
      {/* 페이지 헤더 */}
      <div className="page-header">
        <h1 className="page-title">안녕하세요, 김관리자님 👋</h1>
        <p className="page-subtitle">이번 달 지출 현황과 최근 활동을 확인하세요.</p>
      </div>

      {/* 상단 요약 통계 4칸 */}
      <div className="grid-4 mb-8">
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
      <div className="grid-2 mb-6">
        <div className="card">
          <div className="card-header">
            <span className="card-title">카테고리별 지출</span>
            <a href="#" className="btn btn-ghost btn-sm">
              전체 보기
            </a>
          </div>
          <div className="card-body">
            {BUDGETS.map((b) => (
              <div className="budget-row" key={b.label}>
                <div className="budget-meta">
                  <span className="budget-label">{b.label}</span>
                  <span className="budget-amount">{b.amount}</span>
                </div>
                <div className="track">
                  <div className={`fill ${b.tone}`} style={{ width: `${b.percent}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title">최근 활동</span>
            <span className="badge badge-success">{ACTIVITIES.length}건</span>
          </div>
          <div className="card-body compact">
            {ACTIVITIES.map((a, i) => (
              <div className="activity-item" key={i}>
                <div className={`dot ${a.dot}`} />
                <div>
                  <div className="activity-text">{a.text}</div>
                  <div className="activity-time">{a.time}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 다가오는 일정 */}
      <div className="card mb-6">
        <div className="card-header">
          <span className="card-title">📅 다가오는 일정</span>
          <a href="#" className="btn btn-ghost btn-sm">
            캘린더 전체
          </a>
        </div>
        <div className="card-body compact">
          {UPCOMING.map((u, i) => (
            <div className="activity-item" key={i}>
              <div className={`dot ${u.dot}`} />
              <div>
                <div className="activity-text">{u.text}</div>
                <div className="activity-time">{u.time}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 빠른 실행 */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">빠른 실행</span>
        </div>
        <div className="card-body">
          <div className="grid-4">
            {QUICK_ACTIONS.map((q) => (
              <a className="quick-card" key={q.title} href={q.href}>
                <div className="quick-icon">{q.icon}</div>
                <div>
                  <div className="quick-title">{q.title}</div>
                  <div className="quick-desc">{q.desc}</div>
                </div>
              </a>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
