import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { JobRunStore } from '@leejinyoun/core-jobs';
import type { ExpiredJobRun, JobRunFinish, JobRunId, JobRunStart } from '@leejinyoun/core-jobs';
import { PrismaService } from '../prisma/prisma.service';
import { SystemLogService } from '../system-log/system-log.service';

// core-jobs 실행 기록을 job_run 테이블에 남긴다. 같은 작업의 동시 실행은 running_key 유니크로 막고,
// 실패(lease 만료 포함)는 시스템 로그 화면에서도 보이도록 system_log 에 한 줄 남긴다
@Injectable()
export class PrismaJobRunStore extends JobRunStore {
  constructor(
    private prisma: PrismaService,
    private sysLog: SystemLogService,
  ) {
    super();
  }

  // running_key 유니크 충돌 = 같은 작업이 이미 실행 중(lease 가 살아 있음) → null
  async start(run: JobRunStart): Promise<JobRunId | null> {
    try {
      const row = await this.prisma.jobRun.create({
        data: {
          job: run.job,
          triggered_by: run.trigger,
          status: 'running',
          started_at: run.startedAt,
          lease_until: run.leaseUntil,
          running_key: run.job,
        },
        select: { id: true },
      });
      return row.id;
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') return null;
      throw e;
    }
  }

  // running 인 행만 바꾼다(compare-and-swap) — lease 만료로 이미 마감된 행을 늦게 끝난 결과가 덮지 않게
  async finish(id: JobRunId, result: JobRunFinish): Promise<boolean> {
    const { count } = await this.prisma.jobRun.updateMany({
      where: { id: Number(id), status: 'running' },
      data: {
        status: result.status,
        finished_at: result.finishedAt,
        summary: result.summary ?? null,
        error: result.error ?? null,
        running_key: null,
      },
    });
    if (count && result.status === 'failed') {
      this.sysLog.error({
        category: 'cron',
        message: `예약 작업 실패: ${result.job}`,
        metadata: { runId: Number(id), error: result.error?.split('\n')[0] },
      });
    }
    return count === 1;
  }

  async findExpired(now: Date): Promise<ExpiredJobRun[]> {
    const rows = await this.prisma.jobRun.findMany({
      where: { status: 'running', lease_until: { lt: now } },
      select: { id: true, job: true, started_at: true, lease_until: true },
    });
    return rows.map((r) => ({ id: r.id, job: r.job, startedAt: r.started_at, leaseUntil: r.lease_until }));
  }
}
