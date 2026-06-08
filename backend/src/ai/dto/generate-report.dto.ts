import { IsIn } from 'class-validator';

export const REPORT_PERIODS = ['this_month', 'last_month', 'last_3_months', 'this_year'] as const;
export type ReportPeriod = (typeof REPORT_PERIODS)[number];

export class GenerateReportDto {
  @IsIn(REPORT_PERIODS)
  period!: ReportPeriod;
}
