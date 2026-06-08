/**
 * AI 리포트 공통 타입 · 라벨맵.
 * 백엔드 응답 DTO(/ai/reports)와 1:1 대응한다.
 */

export type InsightTone = 'green' | 'warning' | 'danger';
export type ReportPeriod = 'this_month' | 'last_month' | 'last_3_months' | 'this_year';

export interface AiReportInsight {
  tone: InsightTone;
  text: string;
}

export interface AiReport {
  id: number;
  periodLabel: string;
  periodFrom: string; // YYYY-MM-DD
  periodTo: string; // YYYY-MM-DD
  modelUsed: string;
  summary: string;
  insights: AiReportInsight[];
  tags: string[];
  createdAt: string; // ISO
}

export const REPORT_PERIOD_LABEL: Record<ReportPeriod, string> = {
  this_month: '이번 달',
  last_month: '지난 달',
  last_3_months: '최근 3개월',
  this_year: '올해 전체',
};

// ISO → 'YYYY.MM.DD'
export function formatReportDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}
