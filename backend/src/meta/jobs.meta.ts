import { Injectable } from '@nestjs/common';
import { MetaContributor } from '@leejinyoun/core-common';
import type { MetaSection } from '@leejinyoun/core-common';
import { JobsService } from '@leejinyoun/core-jobs';
import type { JobInfo } from '@leejinyoun/core-jobs';
import { PrismaService } from '../prisma/prisma.service';

const HOUR = 3_600_000;

interface JobMeta {
  name: string;
  cron: string;
  running: boolean;
  nextRunAt: string | null;
  lastRunAt: string | null;
  lastStatus: string | null;
  lastSummary: string | null;
  lastSuccessAt: string | null;
  sinceSuccessH: number | null;
}

// /_meta 의 jobs 구역 — 작업별 마지막 실행·마지막 성공을 job_run 에서 읽어 "며칠째 안 돈 잡"이 드러나게 한다.
// 코어(core-jobs)는 job_run 테이블을 모르므로 조회는 프로젝트가 한다
@Injectable()
export class JobsMetaContributor extends MetaContributor {
  readonly key = 'jobs';

  constructor(
    private jobs: JobsService,
    private prisma: PrismaService,
  ) {
    super();
  }

  async collect(): Promise<MetaSection> {
    const now = Date.now();
    const items = await Promise.all(
      this.jobs.list().map((job) => this.one(job, now)),
    );
    return { count: items.length, items, warn: items.flatMap(warnOf) };
  }

  // 작업 하나의 마지막 실행 + 마지막 성공. job_run 은 90일치라 작고 (job, started_at) 인덱스가 있다
  private async one(job: JobInfo, now: number): Promise<JobMeta> {
    const [last, success] = await Promise.all([
      this.prisma.jobRun.findFirst({
        where: { job: job.name },
        orderBy: { id: 'desc' },
        select: { status: true, started_at: true, summary: true, error: true },
      }),
      this.prisma.jobRun.findFirst({
        where: { job: job.name, status: 'succeeded' },
        orderBy: { id: 'desc' },
        select: { finished_at: true, started_at: true },
      }),
    ]);
    const succeededAt = success?.finished_at ?? success?.started_at ?? null;
    return {
      name: job.name,
      cron: job.cron,
      running: job.running,
      nextRunAt: job.nextRunAt?.toISOString() ?? null,
      lastRunAt: last?.started_at.toISOString() ?? null,
      lastStatus: last?.status ?? null,
      // 실패면 원본 에러의 첫 줄 — 전문은 job_run.error 에 그대로 남아 있다
      lastSummary:
        last?.status === 'failed'
          ? (last.error?.split('\n')[0] ?? null)
          : (last?.summary ?? null),
      lastSuccessAt: succeededAt?.toISOString() ?? null,
      sinceSuccessH: succeededAt
        ? Math.floor((now - succeededAt.getTime()) / HOUR)
        : null,
    };
  }
}

// 확실한 것만 경고한다 — "며칠 이상이면 이상"은 잡마다 주기가 달라(매일/매주/매월) 오탐이 된다.
// 한 번도 실행된 적 없는 잡(배포 후 첫 주기 전)은 경고하지 않는다
function warnOf(job: JobMeta): string[] {
  if (!job.lastRunAt) return [];
  if (job.lastStatus === 'failed') {
    return [`${job.name} — 마지막 실행이 실패: ${job.lastSummary ?? ''}`];
  }
  if (!job.lastSuccessAt) return [`${job.name} — 성공한 적 없음`];
  return [];
}
