import type { PrismaService } from '../prisma/prisma.service';
import { OutboxMetaContributor } from './outbox.meta';

const NOW = new Date('2026-09-23T10:00:00Z');

interface Fixture {
  grouped?: { status: string; _count: { _all: number } }[];
  oldest?: { id: number; channel: string; available_at: Date };
  lastFailed?: {
    id: number;
    channel: string;
    attempts: number;
    last_error: string | null;
    updated_at: Date;
  };
  stuck?: number;
}
interface Section {
  counts: Record<string, number>;
  oldestPending: Record<string, unknown> | null;
  lastFailed: Record<string, unknown> | null;
  warn: string[];
}

function prismaWith({ grouped = [], oldest, lastFailed, stuck = 0 }: Fixture) {
  return {
    outboxMessage: {
      groupBy: jest.fn().mockResolvedValue(grouped),
      // pending 은 available_at 오름차순, failed 는 id 내림차순으로 부른다
      findFirst: jest.fn(({ where }: { where: { status: string } }) =>
        Promise.resolve(
          where.status === 'failed' ? (lastFailed ?? null) : (oldest ?? null),
        ),
      ),
      count: jest.fn().mockResolvedValue(stuck),
    },
  } as unknown as PrismaService;
}

const collect = async (fixture: Fixture): Promise<Section> =>
  (await new OutboxMetaContributor(
    prismaWith(fixture),
  ).collect()) as unknown as Section;

describe('OutboxMetaContributor (/_meta 의 outbox)', () => {
  beforeAll(() => jest.useFakeTimers().setSystemTime(NOW));
  afterAll(() => jest.useRealTimers());

  it('상태별 건수를 세고, 없는 상태는 0 으로 채운다', async () => {
    const section = await collect({
      grouped: [
        { status: 'sent', _count: { _all: 12 } },
        { status: 'pending', _count: { _all: 1 } },
      ],
    });

    expect(section.counts).toEqual({
      pending: 1,
      sending: 0,
      sent: 12,
      failed: 0,
    });
    expect(section.warn).toEqual([]);
  });

  it('마감된 발송이 있으면 경고하고 마지막 건의 원본 에러 첫 줄을 보여준다', async () => {
    const section = await collect({
      grouped: [{ status: 'failed', _count: { _all: 2 } }],
      lastFailed: {
        id: 7,
        channel: 'webpush',
        attempts: 5,
        last_error:
          'Error: getaddrinfo ENOTFOUND push.example\n    at GetAddrInfo',
        updated_at: new Date('2026-09-23T09:30:00Z'),
      },
    });

    expect(section.lastFailed).toEqual({
      id: 7,
      channel: 'webpush',
      attempts: 5,
      at: '2026-09-23T09:30:00.000Z',
      error: 'Error: getaddrinfo ENOTFOUND push.example',
    });
    expect(section.warn).toEqual([
      '마감된 발송 2건 — /logs 의 "알림 발송 실패" 참고',
    ]);
  });

  it('대기가 오래 밀리면 경고한다 — 디스패처가 멈춘 것을 드러낸다', async () => {
    const section = await collect({
      grouped: [{ status: 'pending', _count: { _all: 3 } }],
      oldest: {
        id: 9,
        channel: 'webpush',
        available_at: new Date('2026-09-23T08:15:00Z'),
      },
    });

    expect(section.oldestPending).toEqual({
      id: 9,
      channel: 'webpush',
      waitingMin: 105,
    });
    expect(section.warn).toEqual([
      '가장 오래 밀린 대기 105분 — 디스패처가 도는지 확인',
    ]);
  });

  it('막 적재된 대기는 경고하지 않는다', async () => {
    const section = await collect({
      grouped: [{ status: 'pending', _count: { _all: 1 } }],
      oldest: {
        id: 10,
        channel: 'webpush',
        available_at: new Date('2026-09-23T09:59:00Z'),
      },
    });

    expect(section.oldestPending).toMatchObject({ waitingMin: 1 });
    expect(section.warn).toEqual([]);
  });

  it('선점만 잡고 끝나지 않은 발송이 있으면 경고한다', async () => {
    const section = await collect({
      grouped: [{ status: 'sending', _count: { _all: 1 } }],
      stuck: 1,
    });

    expect(section.warn).toEqual(['선점이 만료된 채 남은 발송 1건']);
  });
});
