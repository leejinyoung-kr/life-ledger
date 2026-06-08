'use client';

/**
 * AI 리포트 페이지.
 * 가계부 데이터를 OpenAI API로 분석해 소비 패턴·절약 인사이트를 리포트로 생성·보관한다.
 * 공통 레이아웃(AppShell)을 재사용하고, 생성은 더미(setTimeout) 시뮬레이션. (TODO: OpenAI API)
 * 스타일: Tailwind + 공통 컴포넌트(Card/Button/Badge).
 */
import { useEffect, useState, type ReactNode } from 'react';
import AppShell from '@/components/AppShell';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Toggle from '@/components/ui/Toggle';
import { Card, CardBody } from '@/components/ui/Card';
import { IconCube } from '@/components/icons';
import { api } from '@/lib/api';
import { notify } from '@/lib/toast';

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

const INS_DOT: Record<InsTone, string> = { green: 'bg-accent', warning: 'bg-warning', danger: 'bg-danger' };

export default function AiReportPage() {
  const [generating, setGenerating] = useState(false);
  const [autoMonthly, setAutoMonthly] = useState(true); // 매월 1일 자동 생성 (설정 notifMonthly 와 동기화)

  // 설정에서 자동 생성 여부 로드
  useEffect(() => {
    api.get<{ notifMonthly: boolean }>('/settings').then((s) => setAutoMonthly(s.notifMonthly)).catch(() => {});
  }, []);

  // 자동 생성 토글 — 즉시 설정 저장
  function toggleAuto() {
    const next = !autoMonthly;
    setAutoMonthly(next);
    api.put('/settings', { notifMonthly: next })
      .then(() => notify.saved())
      .catch(() => { setAutoMonthly(!next); notify.saveFailed(); });
  }

  // 리포트 생성 — 더미 2.5초 후 완료. TODO: POST /api/v1/reports (OpenAI API 분석)
  function generateReport() {
    if (generating) return;
    setGenerating(true);
    setTimeout(() => setGenerating(false), 2500);
  }

  return (
    <AppShell activePath="/ai-report" topbarLabel="AI 리포트">
      <div className="mb-7">
        <h1 className="[font-family:var(--font-display)] text-[1.55rem] font-bold tracking-[-0.03em] text-primary">AI 리포트</h1>
        <p className="text-sm text-secondary mt-1.5">가계부 데이터를 분석하여 소비 패턴과 절약 인사이트를 제공합니다.</p>
      </div>

      {/* 정기 생성 토글 */}
      <div className="flex items-center justify-end gap-2 px-[18px] py-3.5 bg-surface border border-border rounded-[var(--radius-lg)] mb-5">
        <span className="text-[0.82rem] text-secondary">매월 1일 자동 생성</span>
        <Toggle on={autoMonthly} onToggle={toggleAuto} label="매월 자동 생성 토글" />
      </div>

      {/* 새 리포트 생성 박스 */}
      <div className="border border-dashed border-border rounded-[var(--radius-lg)] px-6 py-12 flex flex-col items-center gap-4 text-center mb-7 transition-all hover:border-accent hover:bg-accent-dim [&>svg]:text-accent">
        <IconCube width={34} height={34} />
        <div>
          <div className="[font-family:var(--font-display)] font-bold text-primary mb-1.5">새 리포트 생성</div>
          <div className="text-[0.855rem] text-secondary">이번 달 또는 원하는 기간의 소비 패턴을 AI로 분석합니다.</div>
        </div>
        <div className="flex items-center gap-3 flex-wrap justify-center">
          <select className="input w-auto" aria-label="분석 기간">
            <option>이번 달 (2025.05)</option>
            <option>지난 달 (2025.04)</option>
            <option>최근 3개월</option>
            <option>올해 전체</option>
          </select>
          <Button onClick={generateReport} disabled={generating}>
            {generating && <span className="inline-block w-[18px] h-[18px] border-2 border-white/40 border-t-white rounded-full animate-spin" />}
            {generating ? '분석 중...' : '리포트 생성'}
          </Button>
        </div>
      </div>

      {/* 저장된 리포트 */}
      <div className="flex items-center gap-2 mb-6">
        <span className="text-[0.875rem] font-semibold text-primary">저장된 리포트</span>
        <Badge tone="neutral">2개</Badge>
      </div>

      {/* 4월 리포트 (인사이트 + 태그) */}
      <ReportCard title="2025년 4월 소비 분석 리포트" date="생성일: 2025.05.02 · GPT-4o mini" insights={APRIL_INSIGHTS} tags={APRIL_TAGS}>
        4월 총 지출은 <strong>₩748,200</strong>으로, 전월 대비 <span className="hi">▼ 8.3% 감소</span>했습니다. 수입 대비 지출 비율은 <strong>23.4%</strong>로 건전한 수준을 유지하고 있습니다.
      </ReportCard>

      {/* 3월 리포트 (요약만) */}
      <ReportCard title="2025년 3월 소비 분석 리포트" date="생성일: 2025.04.01 · GPT-4o mini">
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
    <Card className="mb-4">
      <CardBody>
        <div className="flex items-start gap-3 mb-3.5">
          <div className="w-[38px] h-[38px] rounded-[var(--radius)] bg-accent-dim border border-[rgba(0,192,127,0.2)] flex items-center justify-center text-accent shrink-0"><IconCube width={17} height={17} /></div>
          <div className="flex-1">
            <div className="[font-family:var(--font-display)] text-[0.95rem] font-bold text-primary">{title}</div>
            <div className="text-[0.75rem] text-muted mt-0.5">{date}</div>
          </div>
          <Badge tone="success">완료</Badge>
        </div>
        <p className="text-[0.875rem] text-secondary leading-[1.8] [&_strong]:text-primary [&_strong]:font-semibold [&_.hi]:text-accent [&_.hi]:font-semibold [&_.warn]:text-warning [&_.warn]:font-semibold">{children}</p>

        {insights && (
          <div className="flex flex-col gap-2.5 mt-4">
            {insights.map((ins, i) => (
              <div className="flex gap-3 px-3.5 py-3 bg-surface border border-border rounded-[var(--radius)]" key={i}>
                <div className={`w-1.5 h-1.5 rounded-full shrink-0 mt-[7px] ${INS_DOT[ins.tone]}`} />
                <div className="text-[0.845rem] text-secondary leading-relaxed [&_strong]:text-primary [&_.warn]:text-warning [&_.warn]:font-semibold">{ins.node}</div>
              </div>
            ))}
          </div>
        )}

        {tags && (
          <div className="flex flex-wrap gap-1.5 mt-3.5">
            {tags.map((t) => <span className="px-2.5 py-[3px] rounded-full text-[0.75rem] bg-surface text-secondary border border-border" key={t}>{t}</span>)}
          </div>
        )}
      </CardBody>
    </Card>
  );
}
