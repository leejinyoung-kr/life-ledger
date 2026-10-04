import { Injectable } from '@nestjs/common';
import { MetaContributor } from '@leejinyoung-kr/core-common';
import type { MetaSection } from '@leejinyoung-kr/core-common';
import { PrismaService } from '../prisma/prisma.service';

const MINUTE = 60_000;
// 이 시간보다 오래 대기한 메시지가 있으면 디스패처가 안 돌고 있다는 뜻 (주기는 10초, 재시도 간격은 최대 6시간)
const STALE_PENDING_MIN = 30;
// 선점은 60초짜리라 만료된 행은 다음 주기에 회수된다 — 잠깐 보이는 것은 정상이라 넉넉히 두고 본다
const STUCK_CLAIM_MIN = 5;

// /_meta 의 outbox 구역 — 알림 발송이 밀렸는지·마감됐는지. 테이블은 프로젝트 스키마라 코어가 아니라 여기서 읽는다
@Injectable()
export class OutboxMetaContributor extends MetaContributor {
  readonly key = 'outbox';

  constructor(private prisma: PrismaService) {
    super();
  }

  async collect(): Promise<MetaSection> {
    const now = new Date();
    const [grouped, oldest, lastFailed, stuck] = await Promise.all([
      this.prisma.outboxMessage.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
      this.prisma.outboxMessage.findFirst({
        where: { status: 'pending' },
        orderBy: { available_at: 'asc' },
        select: { id: true, channel: true, available_at: true },
      }),
      this.prisma.outboxMessage.findFirst({
        where: { status: 'failed' },
        orderBy: { id: 'desc' },
        select: {
          id: true,
          channel: true,
          attempts: true,
          last_error: true,
          updated_at: true,
        },
      }),
      this.prisma.outboxMessage.count({
        where: {
          status: 'sending',
          claimed_until: {
            lt: new Date(now.getTime() - STUCK_CLAIM_MIN * MINUTE),
          },
        },
      }),
    ]);

    const counts = { pending: 0, sending: 0, sent: 0, failed: 0 };
    for (const row of grouped) counts[row.status] = row._count._all;
    const waitingMin = oldest
      ? Math.floor((now.getTime() - oldest.available_at.getTime()) / MINUTE)
      : null;

    return {
      counts,
      oldestPending: oldest
        ? { id: oldest.id, channel: oldest.channel, waitingMin }
        : null,
      lastFailed: lastFailed
        ? {
            id: lastFailed.id,
            channel: lastFailed.channel,
            attempts: lastFailed.attempts,
            at: lastFailed.updated_at.toISOString(),
            error: lastFailed.last_error?.split('\n')[0] ?? null,
          }
        : null,
      warn: [
        ...(counts.failed
          ? [`마감된 발송 ${counts.failed}건 — /logs 의 "알림 발송 실패" 참고`]
          : []),
        ...(waitingMin !== null && waitingMin >= STALE_PENDING_MIN
          ? [`가장 오래 밀린 대기 ${waitingMin}분 — 디스패처가 도는지 확인`]
          : []),
        ...(stuck ? [`선점이 만료된 채 남은 발송 ${stuck}건`] : []),
      ],
    };
  }
}
