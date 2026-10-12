'use client';

/**
 * AI 리포트 페이지.
 * 가계부 데이터를 OpenAI API로 분석해 소비 패턴·절약 인사이트를 리포트로 생성·보관한다.
 * 공통 레이아웃(AppShell)을 재사용하고, 생성·목록은 백엔드 /ai/reports 와 연동한다.
 * 스타일: Tailwind + 공통 컴포넌트(Card/Button/Badge).
 */
import { useState } from 'react';
import AppShell from '@/components/AppShell';
import PageHeader from '@/components/PageHeader';
import ErrorBanner from '@/components/ErrorBanner';
import { useConfirm } from '@/components/ConfirmModal';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import { Card, CardBody } from '@/components/ui/Card';
import { IconCube } from '@/components/icons';
import { api } from '@/lib/api';
import { notify } from '@/lib/toast';
import { useApiQuery, useInvalidate } from '@/lib/query';
import { qk } from '@/lib/queryKeys';
import {
  REPORT_PERIOD_LABEL, formatReportDate,
  type AiReport, type ReportPeriod, type InsightTone,
} from '@/lib/aiReport';

const INS_DOT: Record<InsightTone, string> = { green: 'bg-accent', warning: 'bg-warning', danger: 'bg-danger' };
const INS_TEXT: Record<InsightTone, string> = { green: '', warning: 'text-warning', danger: 'text-danger' };
const PERIOD_OPTIONS: ReportPeriod[] = ['this_month', 'last_month', 'last_3_months', 'this_year'];

export default function AiReportPage() {
  const [period, setPeriod] = useState<ReportPeriod>('this_month');
  const [saving, setSaving] = useState(false);
  const invalidate = useInvalidate();
  const { confirm, confirmElement } = useConfirm();

  const reportsQuery = useApiQuery<AiReport[]>(qk.aiReports.list(), '/ai/reports');
  const reports = reportsQuery.data ?? [];

  // 리포트 생성 — 선택한 기간의 가계부 데이터를 분석해 저장 (OpenAI 비용 발생 → 컨펌 후 진행, 1일 1회 제한은 서버에서 검사)
  async function handleGenerateReport() {
    if (saving) return;
    if (!await confirm(`${REPORT_PERIOD_LABEL[period]} 데이터를 분석해 리포트를 생성할까요? OpenAI API 호출 비용이 발생하며, 리포트는 하루에 한 번만 생성할 수 있습니다(자정 기준 초기화).`, 'primary')) return;
    setSaving(true);
    try {
      await api.post<AiReport>('/ai/reports', { period });
      notify.success('리포트가 생성됐습니다.');
      invalidate(qk.aiReports.list());
    } catch (err) {
      notify.error((err as Error).message || '리포트 생성에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell activePath="/ai-report" topbarLabel="AI 리포트">
      <PageHeader title="AI 리포트" description="가계부 데이터를 분석하여 소비 패턴과 절약 인사이트를 제공합니다. 매월 자동 생성 여부는 설정 &gt; 알림에서 켤 수 있습니다." />

      {/* 새 리포트 생성 박스 */}
      <div className="border border-dashed border-border rounded-[var(--radius-lg)] px-6 py-12 flex flex-col items-center gap-4 text-center mb-7 transition-all hover:border-accent hover:bg-accent-dim [&>svg]:text-accent">
        <IconCube width={34} height={34} />
        <div>
          <div className="[font-family:var(--font-display)] font-bold text-primary mb-1.5">새 리포트 생성</div>
          <div className="text-[0.855rem] text-secondary">이번 달 또는 원하는 기간의 소비 패턴을 AI로 분석합니다.</div>
        </div>
        <div className="flex items-center gap-3 flex-wrap justify-center">
          <select className="input w-auto" aria-label="분석 기간" value={period} onChange={(ev) => setPeriod(ev.target.value as ReportPeriod)}>
            {PERIOD_OPTIONS.map((p) => <option key={p} value={p}>{REPORT_PERIOD_LABEL[p]}</option>)}
          </select>
          <Button onClick={handleGenerateReport} disabled={saving}>
            {saving && <span className="inline-block w-[18px] h-[18px] border-2 border-white/40 border-t-white rounded-full animate-spin" />}
            {saving ? '분석 중...' : '리포트 생성'}
          </Button>
        </div>
      </div>

      {/* 저장된 리포트 */}
      <div className="flex items-center gap-2 mb-6">
        <span className="text-[0.875rem] font-semibold text-primary">저장된 리포트</span>
        <Badge tone="neutral">{reports.length}개</Badge>
      </div>

      <ErrorBanner message={reportsQuery.error?.message} className="mb-4" />
      {!reportsQuery.error && reports.length === 0 && (
        <p className="text-[0.82rem] text-muted">아직 생성된 리포트가 없습니다. 위에서 분석 기간을 선택하고 리포트를 생성해보세요.</p>
      )}

      {reports.map((r) => <ReportCard key={r.id} report={r} />)}
      {confirmElement}
    </AppShell>
  );
}

// 저장된 리포트 카드 — 요약 + 인사이트 목록 + 태그
function ReportCard({ report }: { report: AiReport }) {
  return (
    <Card className="mb-4">
      <CardBody>
        <div className="flex items-start gap-3 mb-3.5">
          <div className="w-[38px] h-[38px] rounded-[var(--radius)] bg-accent-dim border border-[rgba(0,192,127,0.2)] flex items-center justify-center text-accent shrink-0"><IconCube width={17} height={17} /></div>
          <div className="flex-1">
            <div className="[font-family:var(--font-display)] text-[0.95rem] font-bold text-primary">{report.periodLabel} 소비 분석 리포트</div>
            <div className="text-[0.75rem] text-muted mt-0.5">생성일: {formatReportDate(report.createdAt)} · {report.modelUsed}</div>
          </div>
          <Badge tone="success">완료</Badge>
        </div>
        <p className="text-[0.875rem] text-secondary leading-[1.8]">{report.summary}</p>

        {report.insights.length > 0 && (
          <div className="flex flex-col gap-2.5 mt-4">
            {report.insights.map((ins, i) => (
              <div className="flex gap-3 px-3.5 py-3 bg-surface border border-border rounded-[var(--radius)]" key={i}>
                <div className={`w-1.5 h-1.5 rounded-full shrink-0 mt-[7px] ${INS_DOT[ins.tone]}`} />
                <div className={`text-[0.845rem] leading-relaxed ${INS_TEXT[ins.tone] || 'text-secondary'}`}>{ins.text}</div>
              </div>
            ))}
          </div>
        )}

        {report.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3.5">
            {report.tags.map((t) => <span className="px-2.5 py-[3px] rounded-full text-[0.75rem] bg-surface text-secondary border border-border" key={t}>{t}</span>)}
          </div>
        )}
      </CardBody>
    </Card>
  );
}
