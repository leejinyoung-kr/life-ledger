import { Prisma } from '@prisma/client';
import { PrismaJobRunStore } from './job-run.store';

// job_run 저장소 회귀 테스트 — 동시 실행 차단(유니크 충돌 → null), running 행만 마감(compare-and-swap),
// 실패 시 시스템 로그 한 줄, lease 지난 running 조회. Prisma 는 가짜로 대체
describe('PrismaJobRunStore', () => {
  let prisma: any;
  let sysLog: { error: jest.Mock };
  let store: PrismaJobRunStore;

  const start = {
    job: 'db-backup',
    trigger: 'schedule' as const,
    startedAt: new Date('2026-09-20T04:00:00+09:00'),
    leaseUntil: new Date('2026-09-20T04:30:00+09:00'),
  };

  beforeEach(() => {
    prisma = {
      jobRun: {
        create: jest.fn().mockResolvedValue({ id: 7 }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    sysLog = { error: jest.fn() };
    store = new PrismaJobRunStore(prisma, sysLog as any);
  });

  it('시작을 running 으로 기록하고 running_key 에 작업 이름을 넣는다', async () => {
    expect(await store.start(start)).toBe(7);
    expect(prisma.jobRun.create).toHaveBeenCalledWith({
      data: {
        job: 'db-backup',
        triggered_by: 'schedule',
        status: 'running',
        started_at: start.startedAt,
        lease_until: start.leaseUntil,
        running_key: 'db-backup',
      },
      select: { id: true },
    });
  });

  it('running_key 유니크 충돌(P2002)이면 이미 실행 중 → null', async () => {
    prisma.jobRun.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', { code: 'P2002', clientVersion: 'test' }),
    );
    expect(await store.start(start)).toBeNull();
  });

  it('그 밖의 DB 오류는 그대로 던진다(core-jobs 가 실행하지 않고 건너뜀)', async () => {
    prisma.jobRun.create.mockRejectedValue(new Error('connect ETIMEDOUT'));
    await expect(store.start(start)).rejects.toThrow('connect ETIMEDOUT');
  });

  it('running 인 행만 마감하고 running_key 를 비운다 — 실패면 시스템 로그에 첫 줄을 남긴다', async () => {
    const finishedAt = new Date();
    const ok = await store.finish(7, {
      job: 'db-backup',
      status: 'failed',
      finishedAt,
      error: 'Error: Access denied\n    at spawn',
    });
    expect(ok).toBe(true);
    expect(prisma.jobRun.updateMany).toHaveBeenCalledWith({
      where: { id: 7, status: 'running' },
      data: {
        status: 'failed',
        finished_at: finishedAt,
        summary: null,
        error: 'Error: Access denied\n    at spawn',
        running_key: null,
      },
    });
    expect(sysLog.error).toHaveBeenCalledWith({
      category: 'cron',
      message: '예약 작업 실패: db-backup',
      metadata: { runId: 7, error: 'Error: Access denied' },
    });
  });

  it('이미 마감된 행(lease 만료)이면 false — 덮어쓰지도, 시스템 로그를 남기지도 않는다', async () => {
    prisma.jobRun.updateMany.mockResolvedValue({ count: 0 });
    const ok = await store.finish(7, { job: 'db-backup', status: 'failed', finishedAt: new Date(), error: 'late' });
    expect(ok).toBe(false);
    expect(sysLog.error).not.toHaveBeenCalled();
  });

  it('성공 마감은 시스템 로그를 남기지 않는다', async () => {
    await store.finish(7, { job: 'db-backup', status: 'succeeded', finishedAt: new Date(), summary: 'ok' });
    expect(sysLog.error).not.toHaveBeenCalled();
  });

  it('lease 가 지난 running 행을 찾는다', async () => {
    const now = new Date();
    prisma.jobRun.findMany.mockResolvedValue([
      { id: 3, job: 'trash-purge', started_at: start.startedAt, lease_until: start.leaseUntil },
    ]);
    expect(await store.findExpired(now)).toEqual([
      { id: 3, job: 'trash-purge', startedAt: start.startedAt, leaseUntil: start.leaseUntil },
    ]);
    expect(prisma.jobRun.findMany).toHaveBeenCalledWith({
      where: { status: 'running', lease_until: { lt: now } },
      select: { id: true, job: true, started_at: true, lease_until: true },
    });
  });
});
