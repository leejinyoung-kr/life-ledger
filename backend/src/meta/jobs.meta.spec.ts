import type { JobsService } from '@leejinyoung-kr/core-jobs';
import type { PrismaService } from '../prisma/prisma.service';
import { JobsMetaContributor } from './jobs.meta';

const NOW = new Date('2026-09-23T10:00:00Z');

interface LastRun {
  status: string;
  started_at: Date;
  summary: string | null;
  error: string | null;
}
interface Rows {
  last?: LastRun;
  success?: { finished_at: Date };
}
interface Section {
  count: number;
  items: Record<string, unknown>[];
  warn: string[];
}

// JobsService.list() 가 돌려주는 모양 (등록된 잡 + 다음 실행 시각)
const jobs = (...names: string[]) =>
  ({
    list: () =>
      names.map((name) => ({
        name,
        cron: '0 9 * * *',
        leaseMs: 600_000,
        source: `${name}.run`,
        running: false,
        nextRunAt: new Date('2026-09-24T00:00:00Z'),
      })),
  }) as unknown as JobsService;

// job_run 조회 두 번(마지막 실행 / 마지막 성공)을 잡 이름별로 흉내낸다
function prismaWith(rows: Record<string, Rows>) {
  return {
    jobRun: {
      findFirst: jest.fn(
        ({ where }: { where: { job: string; status?: string } }) =>
          Promise.resolve(
            where.status === 'succeeded'
              ? (rows[where.job]?.success ?? null)
              : (rows[where.job]?.last ?? null),
          ),
      ),
    },
  } as unknown as PrismaService;
}

const collect = async (
  service: JobsService,
  prisma: PrismaService,
): Promise<Section> =>
  (await new JobsMetaContributor(
    service,
    prisma,
  ).collect()) as unknown as Section;

describe('JobsMetaContributor (/_meta 의 jobs)', () => {
  beforeAll(() => jest.useFakeTimers().setSystemTime(NOW));
  afterAll(() => jest.useRealTimers());

  it('작업마다 마지막 실행과 마지막 성공을 합쳐 보여준다', async () => {
    const prisma = prismaWith({
      'trash-purge': {
        last: {
          status: 'succeeded',
          started_at: new Date('2026-09-23T09:00:00Z'),
          summary: '휴지통 0건 삭제',
          error: null,
        },
        success: { finished_at: new Date('2026-09-23T09:00:03Z') },
      },
    });

    const section = await collect(jobs('trash-purge'), prisma);

    expect(section.count).toBe(1);
    expect(section.items[0]).toMatchObject({
      name: 'trash-purge',
      lastStatus: 'succeeded',
      lastSummary: '휴지통 0건 삭제',
      lastSuccessAt: '2026-09-23T09:00:03.000Z',
      sinceSuccessH: 0,
      nextRunAt: '2026-09-24T00:00:00.000Z',
    });
    expect(section.warn).toEqual([]);
  });

  it('마지막 실행이 실패면 경고하고 원본 에러의 첫 줄을 보여준다', async () => {
    const prisma = prismaWith({
      'db-backup': {
        last: {
          status: 'failed',
          started_at: new Date('2026-09-23T04:00:00Z'),
          summary: null,
          error: 'Error: spawn mariadb-dump ENOENT\n    at onErrorNT',
        },
        // 이틀 전에는 성공했었다
        success: { finished_at: new Date('2026-09-21T10:00:00Z') },
      },
    });

    const section = await collect(jobs('db-backup'), prisma);

    expect(section.items[0]).toMatchObject({
      lastSummary: 'Error: spawn mariadb-dump ENOENT',
      sinceSuccessH: 48,
    });
    expect(section.warn).toEqual([
      'db-backup — 마지막 실행이 실패: Error: spawn mariadb-dump ENOENT',
    ]);
  });

  it('실행은 했는데 한 번도 성공한 적이 없으면 경고한다', async () => {
    const prisma = prismaWith({
      'ai-monthly-report': {
        last: {
          status: 'running',
          started_at: new Date('2026-09-23T09:00:00Z'),
          summary: null,
          error: null,
        },
      },
    });

    const section = await collect(jobs('ai-monthly-report'), prisma);

    expect(section.items[0]).toMatchObject({ sinceSuccessH: null });
    expect(section.warn).toEqual(['ai-monthly-report — 성공한 적 없음']);
  });

  it('아직 한 번도 실행되지 않은 잡(첫 주기 전)은 경고하지 않는다 — 매월 잡이 늘 경고로 뜨지 않게', async () => {
    const section = await collect(jobs('holiday-prefetch'), prismaWith({}));

    expect(section.items[0]).toMatchObject({
      lastRunAt: null,
      lastStatus: null,
      lastSuccessAt: null,
    });
    expect(section.warn).toEqual([]);
  });
});
