'use client';

/**
 * AI 리포트 페이지.
 * 가계부 데이터를 Claude API로 분석해 소비 패턴·절약 인사이트를 리포트로 생성·보관한다.
 * 공통 레이아웃(AppShell)을 재사용하고, 생성은 더미(setTimeout) 시뮬레이션. (TODO: Claude API)
 */
import { useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import AppShell from '@/components/AppShell';
import { IconCube } from '@/components/icons';

type InsTone = 'green' | 'warning' | 'danger';
interface Insight { tone: InsTone; node: ReactNode; }

// ── 더미 데이터 (TODO: GET /api/v1/reports) ─────────────────────
const APRIL_INSIGHTS: Insight[] = [
  { tone: 'green', node: <><strong>식비 절약 성공</strong> — 3월 ₩410,000에서 4월 ₩298,000으로 27% 줄었습니다. 외식 횟수 감소가 주요 원인으로 분석됩니다.</> },
  { tone: 'warning', node: <><strong>구독 서비스 비중 증가</strong> — 월정액 합계 <span className="warn">₩187,300</span>으로 전체의 25%를 차지합니다. 미사용 구독 정리를 권장합니다.</> },
  { tone: 'green', node: <><strong>교통비 안정</strong> — 대중교통 위주 이용으로 ₩72,000 수준을 유지 중입니다.</> },
  { tone: 'danger', node: <><strong>충동 구매 패턴 감지</strong> — 주말 저녁(금·토 21~23시) 쇼핑 결제가 집중되어 있습니다. 장바구니 하루 보관 후 구매를 권장합니다.</> },
];
const APRIL_TAGS = ['식비 -27%', '구독 과다', '교통 안정', '주말 충동구매'];

export default function AiReportPage() {
  const router = useRouter();
  const [generating, setGenerating] = useState(false);
  const [autoMonthly, setAutoMonthly] = useState(true); // 매월 1일 자동 생성

  // 인증 가드 — 토큰 없으면 로그인 페이지로. TODO: 토큰 유효성 검증 API 연동
  useEffect(() => {
    if (!localStorage.getItem('auth_token')) {
      router.replace('/login');
    }
  }, [router]);

  // 로그아웃 — 토큰 제거 후 로그인 페이지로 이동
  function logout() {
    localStorage.removeItem('auth_token');
    router.push('/login');
  }

  // 리포트 생성 — 더미 2.5초 후 완료. TODO: POST /api/v1/reports (Claude API 분석)
  function generateReport() {
    if (generating) return;
    setGenerating(true);
    setTimeout(() => setGenerating(false), 2500);
  }

  return (
    <AppShell activePath="/ai-report" topbarLabel="AI 리포트" onLogout={logout}>
      <div className="page-header">
        <h1 className="page-title">AI 리포트</h1>
        <p className="page-subtitle">가계부 데이터를 분석하여 소비 패턴과 절약 인사이트를 제공합니다.</p>
      </div>

      {/* 대화형 질문 안내 + 정기 생성 토글 */}
      <div className="ai-ask-bar">
        <span>💬</span>
        <div className="ai-ask-main">
          <div className="ai-ask-title">대화형으로 물어보기</div>
          <div className="ai-ask-sub">&quot;이번 달 외식비 왜 늘었어?&quot; 처럼 자유롭게 질문</div>
        </div>
        <a href="/assistant" className="btn btn-primary btn-sm">AI 챗 열기</a>
        <div className="divider-v" />
        <div className="ai-ask-schedule">
          <span>매월 1일 자동 생성</span>
          {/* TODO: 자동 생성 설정 저장 API 연동 */}
          <button
            type="button"
            className={`toggle${autoMonthly ? ' on' : ''}`}
            onClick={() => setAutoMonthly((v) => !v)}
            aria-label="매월 자동 생성 토글"
            aria-pressed={autoMonthly}
          />
        </div>
      </div>

      {/* 새 리포트 생성 박스 */}
      <div className="generate-box">
        <IconCube width={34} height={34} />
        <div>
          <div className="generate-title">새 리포트 생성</div>
          <div className="generate-desc">이번 달 또는 원하는 기간의 소비 패턴을 AI로 분석합니다.</div>
        </div>
        <div className="generate-controls">
          <select className="input" aria-label="분석 기간">
            <option>이번 달 (2025.05)</option>
            <option>지난 달 (2025.04)</option>
            <option>최근 3개월</option>
            <option>올해 전체</option>
          </select>
          <button type="button" className="btn btn-primary" onClick={generateReport} disabled={generating}>
            {generating && <span className="spinner" />}
            {generating ? '분석 중...' : '리포트 생성'}
          </button>
        </div>
      </div>

      {/* 저장된 리포트 */}
      <div className="saved-head">
        <span className="saved-head-title">저장된 리포트</span>
        <span className="badge badge-neutral">2개</span>
      </div>

      {/* 4월 리포트 (인사이트 + 태그) */}
      <ReportCard title="2025년 4월 소비 분석 리포트" date="생성일: 2025.05.02 · Claude API" insights={APRIL_INSIGHTS} tags={APRIL_TAGS}>
        4월 총 지출은 <strong>₩748,200</strong>으로, 전월 대비 <span className="hi">▼ 8.3% 감소</span>했습니다. 수입 대비 지출 비율은 <strong>23.4%</strong>로 건전한 수준을 유지하고 있습니다.
      </ReportCard>

      {/* 3월 리포트 (요약만) */}
      <ReportCard title="2025년 3월 소비 분석 리포트" date="생성일: 2025.04.01 · Claude API">
        3월 총 지출은 <strong>₩816,000</strong>으로, 식비가 전체의 <span className="warn">50.2%</span>를 차지했습니다. 외식 빈도가 높았던 달로 절약 여지가 큰 것으로 분석됩니다.
      </ReportCard>
    </AppShell>
  );
}

// 저장된 리포트 카드 — 본문 + (선택) 인사이트 목록 + 태그
function ReportCard({
  title, date, children, insights, tags,
}: {
  title: string; date: string; children: ReactNode;
  insights?: Insight[]; tags?: string[];
}) {
  return (
    <div className="card report-card">
      <div className="card-body">
        <div className="report-card-header">
          <div className="report-icon"><IconCube width={17} height={17} /></div>
          <div className="report-head">
            <div className="report-title">{title}</div>
            <div className="report-date">{date}</div>
          </div>
          <span className="badge badge-success">완료</span>
        </div>
        <p className="report-body">{children}</p>

        {insights && (
          <div className="insight-list">
            {insights.map((ins, i) => (
              <div className="insight-item" key={i}>
                <div className={`ins-dot ${ins.tone}`} />
                <div className="insight-text">{ins.node}</div>
              </div>
            ))}
          </div>
        )}

        {tags && (
          <div className="tag-list">
            {tags.map((t) => <span className="tag" key={t}>{t}</span>)}
          </div>
        )}
      </div>
    </div>
  );
}
